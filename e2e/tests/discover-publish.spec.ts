import type { Browser, Page } from '@playwright/test';

import { apiCreateRecipe } from '../api-helpers';
import { openPageAs } from '../auth';
import { E2E_OPENSEARCH_URL, seedDiscoveryLibrary } from '../db-helpers';
import { DISCOVERY_FIXTURES } from '../discovery-fixtures';
import { expect, test } from '../fixtures';
import { MOCK_USER_2 } from '../mocks/data/users';

test.skip(!E2E_OPENSEARCH_URL, 'needs E2E_OPENSEARCH_URL (a dedicated OpenSearch for e2e)');

const TITLE = 'Grandma Lentil Stew';

// Publishing writes to the shared library, which every other Discover spec reads: put it back after each test.
test.afterEach(async () => {
    await seedDiscoveryLibrary(DISCOVERY_FIXTURES);
});

// A second signed-in user in their own browser context.
const asSecondUser = (browser: Browser): Promise<Page> => openPageAs(browser, MOCK_USER_2);

const ownRecipe = () =>
    apiCreateRecipe(TITLE, [{ name: 'red lentils', quantity: 250, unit: 'g' }, { name: 'onion' }], [], {
        instructions: ['Soften the onion.', 'Simmer the lentils until soft.'],
        tags: ['stew'],
        servings: 4,
        cookTime: 35,
        difficulty: 'easy',
    });

/** The index refreshes about once a second, so a just-published recipe can take a moment to be searchable. */
const searchUntilVisible = async (page: Page, title: string, visible: boolean) => {
    await expect(async () => {
        await page.goto('/discover');
        await page.getByPlaceholder('Search recipes, e.g. lemon cake').fill('lentil');
        const card = page.getByRole('button', { name: new RegExp(title) });
        if (visible) await expect(card).toBeVisible({ timeout: 2000 });
        else {
            await expect(page.getByText(/\d+ recipes?/)).toBeVisible({ timeout: 2000 });
            await expect(card).toHaveCount(0);
        }
    }).toPass({ timeout: 20_000 });
};

test.describe('Publishing recipes to Discover', () => {
    test('user A publishes, user B finds and adds it, then A unpublishes and it disappears for B', async ({
        authenticatedPage: pageA,
        browser,
    }) => {
        test.setTimeout(90_000);
        const recipe = await ownRecipe();
        const pageB = await asSecondUser(browser);

        // A: the licence step must be agreed to before anything is sent.
        await pageA.goto(`/recipes/${recipe.id}`);
        await pageA.getByRole('button', { name: 'Make public' }).click();
        const dialog = pageA.getByRole('dialog');
        await expect(dialog).toContainText('CC BY-SA 4.0');
        await expect(dialog.getByRole('button', { name: 'Make public' })).toBeDisabled();
        await dialog.getByRole('checkbox', { name: /I wrote this recipe myself/ }).click();
        await dialog.getByRole('button', { name: 'Make public' }).click();
        await expect(pageA.getByText('Public', { exact: true })).toBeVisible();
        await expect(pageA.getByRole('button', { name: 'Unpublish' })).toBeVisible();

        // B: finds it in search; the author did not opt in, so the page names nobody.
        await searchUntilVisible(pageB, TITLE, true);
        await pageB.getByRole('button', { name: new RegExp(TITLE) }).click();
        await expect(pageB.getByRole('heading', { name: TITLE })).toBeVisible();
        await expect(pageB.getByText(/Shared by/)).toHaveCount(0);
        await expect(pageB.getByRole('region', { name: 'Source' })).toContainText('by a Tandra user, CC BY-SA 4.0');
        await expect(pageB.getByText('red lentils', { exact: false })).toBeVisible();

        // B can report it, and adds it to their own recipes.
        await pageB.getByRole('button', { name: 'Report' }).click();
        await pageB.getByLabel('Reason for the report').fill('just testing');
        await pageB.getByRole('button', { name: 'Send report' }).click();
        await expect(pageB.getByText(/we'll take a look/)).toBeVisible();

        await pageB.getByRole('button', { name: 'Add to my recipes' }).click();
        await expect(pageB.getByRole('button', { name: 'Added to your recipes' })).toBeDisabled();
        await pageB.goto('/recipes');
        await expect(pageB.getByRole('button', { name: new RegExp(TITLE) })).toBeVisible();

        // A unpublishes (after confirming); the private recipe stays.
        await pageA.getByRole('button', { name: 'Unpublish' }).click();
        await pageA.getByRole('alertdialog').getByRole('button', { name: 'Unpublish' }).click();
        await expect(pageA.getByRole('button', { name: 'Make public' })).toBeVisible();
        await expect(pageA.locator('h1').filter({ hasText: TITLE })).toBeVisible();

        // B no longer finds it in Discover, but keeps the copy they made.
        await searchUntilVisible(pageB, TITLE, false);
        await pageB.goto('/recipes');
        await expect(pageB.getByRole('button', { name: new RegExp(TITLE) })).toBeVisible();

        await pageB.context().close();
    });

    test("shows the author's name only when they opt in", async ({ authenticatedPage: pageA, browser }) => {
        test.setTimeout(60_000);
        const recipe = await ownRecipe();
        const pageB = await asSecondUser(browser);

        await pageA.goto(`/recipes/${recipe.id}`);
        await pageA.getByRole('button', { name: 'Make public' }).click();
        const dialog = pageA.getByRole('dialog');
        await dialog.getByRole('checkbox', { name: /I wrote this recipe myself/ }).click();
        await dialog.getByRole('checkbox', { name: /Show my username/ }).click();
        await dialog.getByRole('button', { name: 'Make public' }).click();
        await expect(pageA.getByText('Public', { exact: true })).toBeVisible();

        await searchUntilVisible(pageB, TITLE, true);
        await pageB.getByRole('button', { name: new RegExp(TITLE) }).click();
        await expect(pageB.getByText('Shared by testuser')).toBeVisible();

        await pageB.context().close();
    });

    test('a recipe imported from a link cannot be made public', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Imported Pie', [{ name: 'apple' }], [], {
            instructions: ['Bake.'],
            link: 'https://example.com/pie',
        });

        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await expect(authenticatedPage.getByText(/can't be made public/)).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Make public' })).toHaveCount(0);
    });

    test('a recipe added from Discover cannot be republished', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/discover/e2e-library-1');
        await authenticatedPage.getByRole('button', { name: 'Add to my recipes' }).click();
        await authenticatedPage.getByRole('link', { name: 'View', exact: true }).click();

        await expect(authenticatedPage.getByText(/can't be made public/)).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Make public' })).toHaveCount(0);
    });
});
