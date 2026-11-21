import { readFile } from 'node:fs/promises';

import type { Download, Page, Request } from '@playwright/test';

import {
    apiAddItem,
    apiCreateList,
    apiCreateListAsOtherUser,
    apiCreateRecipe,
    apiCreateRecipeAsOtherUser,
    apiCreateTodo,
    apiCreateTodoAsOtherUser,
    apiCreateLabel,
    apiSetItemCategory,
} from '../api-helpers';
import { API_BASE, sessionHeaders } from '../auth';
import { seedFriendship, seedRecipeImageKeys } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';
import { currentStack } from '../stack';

test.describe.configure({ timeout: 60_000 });

type Entry = { title?: string; name?: string; ownership?: string; [key: string]: unknown };

type ListEntry = Entry & { items?: Array<{ name: string; category?: string }> };

interface Export {
    meta: Record<string, unknown>;
    lists: Array<ListEntry>;
    recipes: Array<Entry>;
    mealPlans: Array<Entry>;
    todos: Array<Entry>;
    labels: Array<Entry>;
    itemCategories: unknown;
    friends: Array<string | { username: string }>;
}

interface Exported {
    download: Download;
    data: Export;
    raw: string;
    exportRequest: Request;
}

/** Settings → Account → "Export my data": clicks it and returns the downloaded file, parsed. */
const exportMyData = async (page: Page): Promise<Exported> => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();

    await expect(page.getByText('Export my data', { exact: true })).toBeVisible();

    const [exportRequest, download] = await Promise.all([
        page.waitForRequest((request) => request.url().includes('export'), { timeout: 10_000 }),
        page.waitForEvent('download', { timeout: 10_000 }),
        page.getByText('Export my data', { exact: true }).click({ timeout: 10_000 }),
    ]);

    const path = await download.path();
    const raw = await readFile(path, 'utf8');

    return { download, data: JSON.parse(raw) as Export, raw, exportRequest };
};

const called = <T extends Entry>(entries: Array<T>, label: string) =>
    entries.find((entry) => (entry.title ?? entry.name) === label);

test.describe('Settings data export', () => {
    test('a freshly registered user adds data and exports it as one JSON file', async ({ page, registerPage }) => {
        const username = `export${Date.now()}${Math.floor(Math.random() * 1000)}`;
        await registerPage.goto();
        await registerPage.register(username, 'exportpass123', 'exportpass123');
        await page.waitForURL('/');
        await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

        // Data is added as this new user, through the same api the app uses (the page shares the session cookie).
        const asNewUser = { 'Content-Type': 'application/json', Origin: currentStack.webOrigin };

        const put = async (path: string, body: unknown) => {
            const res = await page.request.put(`${API_BASE}${path}`, { headers: asNewUser, data: body });
            expect(res.ok(), `PUT ${path}: ${await res.text()}`).toBe(true);

            return (await res.json()) as { id: string };
        };

        const user = (await (await page.request.get(`${API_BASE}/api/auth/get-session`)).json()) as {
            user: { id: string; username: string };
        };

        const me = { id: user.user.id, username };

        await put('/api/lists', { title: 'Weekend shop', listType: 'shopping', dateAdded: new Date().toISOString() });
        await put(`/api/lists/${encodeURIComponent('Weekend shop')}/items`, {
            itemName: 'oat milk',
            dateAdded: new Date().toISOString(),
        });

        const recipe = await put('/api/recipes', {
            title: 'Pancakes',
            dateAdded: new Date().toISOString(),
            user: me,
            selectedUsers: [],
            ingredients: [{ name: 'flour' }],
            instructions: ['Mix'],
            servings: 2,
        });

        await put('/api/meal-plan', { date: '2030-01-07', recipeId: recipe.id, servings: 2 });
        await put('/api/todos', { title: 'Book the dentist' });
        await put('/api/labels', { name: 'Health', color: '#ff0000' });

        const { download, data, raw } = await exportMyData(page);

        expect(download.suggestedFilename()).toMatch(
            new RegExp(`^tandra-export-${username}-\\d{4}-\\d{2}-\\d{2}\\.json$`)
        );
        expect(Object.keys(data).sort()).toEqual(
            ['friends', 'itemCategories', 'labels', 'lists', 'meta', 'mealPlans', 'recipes', 'todos'].sort()
        );

        const list = called(data.lists, 'Weekend shop');
        expect(list?.items?.map((item) => item.name)).toEqual(['oat milk']);
        expect(list?.ownership).toBe('owned');
        expect(called(data.recipes, 'Pancakes')?.ownership).toBe('owned');
        expect(data.mealPlans).toHaveLength(1);
        expect(data.mealPlans[0].ownership).toBe('owned');
        expect(raw).toContain('2030-01-07');
        expect(called(data.todos, 'Book the dentist')?.ownership).toBe('owned');
        expect(called(data.labels, 'Health')).toBeDefined();
        expect(data.friends).toEqual([]);
    });

    test('meta holds the export date, schema version and what was left out', async ({ authenticatedPage }) => {
        const before = Date.now();
        const { data } = await exportMyData(authenticatedPage);

        const exportedAt = Date.parse(String(data.meta.exportedAt));
        expect(exportedAt).not.toBeNaN();
        expect(Math.abs(exportedAt - before)).toBeLessThan(5 * 60_000);
        expect(data.meta.schemaVersion).toBeDefined();
        expect(data.meta.schemaVersion).not.toBeNull();
        expect(Array.isArray(data.meta.omitted)).toBe(true);
        expect(JSON.stringify(data.meta.omitted)).toMatch(/image/i);
    });

    test('owned and shared-with-me data are both exported and marked as such', async ({ authenticatedPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);

        await apiCreateList('My groceries');
        await apiAddItem('My groceries', 'Milk');
        await apiSetItemCategory('My groceries', 'Milk', 'dairy');
        await apiCreateRecipe('My soup', [{ name: 'leek' }]);
        await apiCreateTodo({ title: 'My errand' });
        await apiCreateLabel({ name: 'My label', color: '#00ff00' });

        await apiCreateListAsOtherUser('Their shared list', [MOCK_USER.id]);
        const theirRecipe = await apiCreateRecipeAsOtherUser('Their shared recipe', [MOCK_USER.id]);
        await apiCreateTodoAsOtherUser({ title: 'Their shared todo', dueDate: '2030-01-08' }, [MOCK_USER.id]);

        const sharedPlan = await fetch(`${API_BASE}/api/meal-plan`, {
            method: 'PUT',
            headers: await sessionHeaders(MOCK_USER_2),
            body: JSON.stringify({
                date: '2030-01-09',
                recipeId: theirRecipe.id,
                servings: 4,
                userIds: [MOCK_USER.id],
            }),
        });

        expect(sharedPlan.ok, await sharedPlan.clone().text()).toBe(true);

        // Not shared with the exporting user: must stay out of their file.
        await apiCreateListAsOtherUser('Their private list', []);
        await apiCreateRecipeAsOtherUser('Their private recipe', []);

        const { data, raw } = await exportMyData(authenticatedPage);

        expect(called(data.lists, 'My groceries')?.ownership).toBe('owned');
        expect(called(data.lists, 'My groceries')?.items?.find((item) => item.name === 'Milk')?.category).toBe('dairy');
        expect(called(data.recipes, 'My soup')?.ownership).toBe('owned');
        expect(called(data.todos, 'My errand')?.ownership).toBe('owned');
        expect(called(data.labels, 'My label')).toBeDefined();

        expect(called(data.lists, 'Their shared list')?.ownership).toBe('shared');
        expect(called(data.recipes, 'Their shared recipe')?.ownership).toBe('shared');
        expect(called(data.todos, 'Their shared todo')?.ownership).toBe('shared');
        expect(data.mealPlans.find((entry) => entry.recipeId === theirRecipe.id)?.ownership).toBe('shared');

        expect(raw).not.toContain('Their private list');
        expect(raw).not.toContain('Their private recipe');

        expect(data.itemCategories).toBeTruthy();
        expect(typeof data.itemCategories).toBe('object');
    });

    test('friends are listed by username', async ({ authenticatedPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);

        const { data } = await exportMyData(authenticatedPage);

        const usernames = data.friends.map((friend) => (typeof friend === 'string' ? friend : friend.username));
        expect(usernames).toEqual([MOCK_USER_2.username]);
    });

    test('images are referenced by their storage key, never embedded', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Pictured', [{ name: 'egg' }]);
        await seedRecipeImageKeys(recipe.id, { coverImageKey: 'recipe-upload/export-cover.webp' });

        const { data, raw } = await exportMyData(authenticatedPage);

        expect(called(data.recipes, 'Pictured')?.coverImageKey).toBe('recipe-upload/export-cover.webp');
        expect(raw).not.toContain('data:image');
    });

    test('the download is an attachment and the endpoint refuses callers without a session', async ({
        authenticatedPage,
    }) => {
        const { exportRequest } = await exportMyData(authenticatedPage);

        const response = await exportRequest.response();
        expect(response?.status()).toBe(200);
        expect(response?.headers()['content-disposition']).toMatch(/^attachment;/);
        expect(response?.headers()['content-disposition']).toMatch(
            /filename="?tandra-export-testuser-\d{4}-\d{2}-\d{2}\.json"?/
        );

        const anonymous = await fetch(exportRequest.url(), { method: exportRequest.method() });
        expect(anonymous.status).toBe(401);
        expect(await anonymous.text()).not.toContain('"lists"');
    });
});
