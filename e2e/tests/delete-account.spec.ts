import type { Page } from '@playwright/test';

import { apiCreateListAsOtherUser } from '../api-helpers';
import { API_BASE, openPageAs } from '../auth';
import { seedFriendship } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER_2 } from '../mocks/data/users';

test.describe.configure({ timeout: 60_000 });

const PASSWORD = 'password123';

const confirmDeleteButton = (page: Page) => page.getByRole('button', { name: /delete/i }).last();

test.describe('Delete my account', () => {
    test('signs you out for good, frees nothing for sign-in, and leaves the other user their shared list', async ({
        page,
        registerPage,
        loginPage,
        browser,
    }) => {
        const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const username = `leaver${stamp}`;
        const sharedListTitle = `Shared with ${username}`;
        const ownListTitle = `Own list ${stamp}`;

        // Register through the form: this is the account that will be deleted.
        await registerPage.goto();
        await registerPage.register(username, PASSWORD, PASSWORD);
        await page.waitForURL('/');

        const session = await page.request.get(`${API_BASE}/api/auth/get-session`);
        const { user } = (await session.json()) as { user: { id: string } };

        // Some data of their own: a list with items, and a recipe.
        const ownList = await page.request.put(`${API_BASE}/api/lists`, {
            data: { title: ownListTitle, listType: 'shopping', dateAdded: new Date().toISOString() },
        });

        expect(ownList.ok()).toBe(true);

        for (const itemName of ['Milk', 'Eggs']) {
            const item = await page.request.put(`${API_BASE}/api/lists/${encodeURIComponent(ownListTitle)}/items`, {
                data: { itemName, dateAdded: new Date().toISOString() },
            });

            expect(item.ok()).toBe(true);
        }

        const recipe = await page.request.put(`${API_BASE}/api/recipes`, {
            data: { title: `Soup ${stamp}`, ingredients: [{ name: 'Carrot' }], instructions: ['Simmer'] },
        });

        expect(recipe.ok()).toBe(true);

        // The other user shares a list with them, so the two are friends first.
        await seedFriendship({ id: user.id, username }, MOCK_USER_2);
        await apiCreateListAsOtherUser(sharedListTitle, [user.id]);

        // Settings → Account: delete it, confirming by typing the username.
        await page.goto('/settings');
        await page.getByRole('button', { name: /delete my account/i }).click();
        await expect(confirmDeleteButton(page)).toBeDisabled();
        await page.getByRole('textbox').fill(username);
        await confirmDeleteButton(page).click();

        // Signed out, and it stays that way.
        await page.waitForURL('/login');
        await page.goto('/');
        await page.waitForURL('/login');

        // The username can no longer sign in.
        await loginPage.goto();
        await loginPage.login(username, PASSWORD);
        await expect(loginPage.errorMessage).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);

        // The other user still has the list that was shared with the deleted account.
        const other = await openPageAs(browser, MOCK_USER_2);

        try {
            await other.goto('/');
            await expect(other.getByRole('button', { name: sharedListTitle })).toBeVisible();
        } finally {
            await other.context().close();
        }
    });

    test('does nothing until the typed username matches', async ({ page, registerPage }) => {
        const username = `keeper${Date.now()}${Math.floor(Math.random() * 1000)}`;

        await registerPage.goto();
        await registerPage.register(username, PASSWORD, PASSWORD);
        await page.waitForURL('/');

        await page.goto('/settings');
        await page.getByRole('button', { name: /delete my account/i }).click();
        await page.getByRole('textbox').fill('not-my-username');
        await expect(confirmDeleteButton(page)).toBeDisabled();

        // Still signed in after a reload.
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    });
});
