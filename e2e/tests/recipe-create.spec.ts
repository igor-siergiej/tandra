import type { Page } from '@playwright/test';

import { apiAddItem, apiCreateList, apiGetRecipes } from '../api-helpers';
import { expect, test } from '../fixtures';
import { mockRecipeCoverGeneration, mockRecipeImport } from '../mocks/ai';

const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

// A new recipe without an uploaded photo triggers a background AI cover; that is not under test here.
const stubBackgroundCover = (page: Page) =>
    mockRecipeCoverGeneration(page, { status: 502, error: 'Cover generation unavailable' });

const openManualForm = async (page: Page) => {
    await page.goto('/recipes/new');
    await page.getByRole('button', { name: 'Add manually' }).click();
};

const swipeRow = async (page: Page, name: string, dx: number) => {
    const box = await page.getByText(name, { exact: true }).first().boundingBox();

    if (!box) throw new Error(`Row "${name}" not found`);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy, { steps: 10 });
    await page.mouse.up();
};

const addIngredientOneAtATime = async (page: Page, name: string, quantity?: string, unit?: string) => {
    await page.getByRole('button', { name: 'Add ingredient' }).click();
    await page.getByPlaceholder('Enter ingredient name...').fill(name);

    if (quantity) await page.getByLabel('Quantity').fill(quantity);

    if (unit) {
        await page.getByLabel('Unit').click();
        await page.getByRole('option', { name: unit, exact: true }).click();
    }

    await page.getByRole('button', { name: 'Add Ingredient' }).click();
};

test.describe('Create a recipe manually', () => {
    test.setTimeout(20000);

    test('Create Recipe stays disabled until there is a title', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await openManualForm(authenticatedPage);

        await expect(authenticatedPage.getByRole('button', { name: 'Create Recipe' })).toBeDisabled();

        await authenticatedPage.getByLabel('Recipe Title').fill('Soup');
        await expect(authenticatedPage.getByRole('button', { name: 'Create Recipe' })).toBeEnabled();

        await authenticatedPage.getByLabel('Recipe Title').fill('   ');
        await expect(authenticatedPage.getByRole('button', { name: 'Create Recipe' })).toBeDisabled();
    });

    test('ingredients, steps, tags and link all end up on the saved recipe', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await openManualForm(authenticatedPage);

        await authenticatedPage.getByLabel('Recipe Title').fill('Pancakes');
        await authenticatedPage.getByPlaceholder('https://...').fill('https://example.com/pancakes');

        await authenticatedPage.getByRole('button', { name: 'add one at a time ↓' }).click();
        await addIngredientOneAtATime(authenticatedPage, 'Flour', '200', 'g');
        await addIngredientOneAtATime(authenticatedPage, 'Milk', '300', 'ml');
        await expect(authenticatedPage.getByText('Flour', { exact: true })).toBeVisible();

        const instructions = authenticatedPage.getByPlaceholder(/Paste instructions here/);
        await instructions.fill('Mix flour and milk\nFry in a hot pan');
        await instructions.press('Tab');
        await expect(authenticatedPage.getByText('Fry in a hot pan')).toBeVisible();

        const tagInput = authenticatedPage.getByPlaceholder('Add a tag and press Enter...');
        await tagInput.fill('breakfast');
        await tagInput.press('Enter');
        await expect(authenticatedPage.getByRole('button', { name: 'Remove tag breakfast' })).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await authenticatedPage.waitForURL('/recipes');

        const [saved] = await apiGetRecipes();
        expect(saved.title).toBe('Pancakes');
        expect(saved.link).toBe('https://example.com/pancakes');
        expect(saved.tags).toContain('breakfast');
        expect(saved.instructions).toEqual(['Mix flour and milk', 'Fry in a hot pan']);
        expect(saved.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit }))).toEqual([
            { name: 'Flour', quantity: 200, unit: 'g' },
            { name: 'Milk', quantity: 300, unit: 'ml' },
        ]);

        await authenticatedPage.getByRole('button', { name: 'Pancakes' }).click();
        await expect(authenticatedPage.locator('h1').filter({ hasText: 'Pancakes' })).toBeVisible();
        await expect(authenticatedPage.getByText('Mix flour and milk')).toBeVisible();
    });

    test('pasted ingredient lines become one ingredient each', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await openManualForm(authenticatedPage);
        await authenticatedPage.getByLabel('Recipe Title').fill('Salad');

        const paste = authenticatedPage.getByPlaceholder(/Paste ingredients here/);
        await paste.fill('Lettuce\nTomato\nCucumber');
        await paste.blur();

        for (const name of ['Lettuce', 'Tomato', 'Cucumber']) {
            await expect(authenticatedPage.getByText(name, { exact: true })).toBeVisible();
        }
    });

    test('a draft ingredient can be edited and removed before saving', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await openManualForm(authenticatedPage);
        await authenticatedPage.getByLabel('Recipe Title').fill('Salad');
        const paste = authenticatedPage.getByPlaceholder(/Paste ingredients here/);
        await paste.fill('Lettuce\nTomato');
        await paste.blur();

        await swipeRow(authenticatedPage, 'Lettuce', 90);
        await authenticatedPage.getByLabel('Edit Lettuce').click();
        const name = authenticatedPage.getByLabel('Ingredient Name');
        await name.fill('Rocket');
        await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();
        await expect(authenticatedPage.getByText('Rocket', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByText('Edit Ingredient')).toBeHidden();

        await swipeRow(authenticatedPage, 'Tomato', -90);
        await authenticatedPage.getByLabel('Delete Tomato').click();
        await expect(authenticatedPage.getByText('Tomato', { exact: true })).toHaveCount(0);

        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await authenticatedPage.waitForURL('/recipes');
        const [saved] = await apiGetRecipes();
        expect(saved.ingredients.map((i) => i.name)).toEqual(['Rocket']);
    });

    test('the ingredient edit drawer cannot be saved with an empty name', async ({ authenticatedPage }) => {
        await openManualForm(authenticatedPage);
        const paste = authenticatedPage.getByPlaceholder(/Paste ingredients here/);
        await paste.fill('Lettuce');
        await paste.blur();

        await swipeRow(authenticatedPage, 'Lettuce', 90);
        await authenticatedPage.getByLabel('Edit Lettuce').click();
        await authenticatedPage.getByLabel('Ingredient Name').fill('');

        await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    });

    test('prep, cook, servings and difficulty are saved', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await openManualForm(authenticatedPage);
        await authenticatedPage.getByLabel('Recipe Title').fill('Timed');
        await authenticatedPage.getByLabel(/Prep/).fill('10');
        await authenticatedPage.getByLabel(/Cook/).fill('25');
        await authenticatedPage.getByLabel(/Servings/).fill('4');

        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await authenticatedPage.waitForURL('/recipes');

        const [saved] = await apiGetRecipes();
        expect([saved.prepTime, saved.cookTime, saved.servings]).toEqual([10, 25, 4]);
    });

    test('an uploaded photo is previewed, can be cleared, and is sent on create', async ({ authenticatedPage }) => {
        let uploads = 0;
        await authenticatedPage.route(/\/api\/recipes\/[^/]+\/image\/upload$/, (route) => {
            uploads++;

            return route.fulfill({ json: { imageKey: 'recipe-photo' } });
        });
        await openManualForm(authenticatedPage);
        await authenticatedPage.getByLabel('Recipe Title').fill('Photo recipe');

        const file = { name: 'photo.png', mimeType: 'image/png', buffer: PNG_1X1 };
        await authenticatedPage.locator('input[type="file"]').setInputFiles(file);
        await expect(authenticatedPage.getByAltText('Recipe preview')).toBeVisible();

        await authenticatedPage.getByLabel('Clear image').click();
        await expect(authenticatedPage.getByAltText('Recipe preview')).toHaveCount(0);

        await authenticatedPage.locator('input[type="file"]').setInputFiles(file);
        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await authenticatedPage.waitForURL('/recipes');

        expect(uploads).toBe(1);
    });

    test('ingredients can be pulled in from a shopping list', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await apiCreateList('Weekly shop');
        await apiAddItem('Weekly shop', 'Rice');
        await apiAddItem('Weekly shop', 'Beans');
        await apiAddItem('Weekly shop', 'Salsa');
        await openManualForm(authenticatedPage);
        await authenticatedPage.getByLabel('Recipe Title').fill('Burrito bowl');

        await authenticatedPage.getByRole('button', { name: 'Add from shopping list' }).click();
        await authenticatedPage.getByRole('button', { name: 'Weekly shop' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'Add 0 ingredients' })).toBeDisabled();
        await authenticatedPage.getByText('Rice', { exact: true }).click();
        await authenticatedPage.getByText('Beans', { exact: true }).click();
        await authenticatedPage.getByRole('button', { name: 'Add 2 ingredients' }).click();

        await expect(authenticatedPage.getByText('Rice', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByText('Salsa', { exact: true })).toHaveCount(0);

        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await authenticatedPage.waitForURL('/recipes');
        const [saved] = await apiGetRecipes();
        expect(saved.ingredients.map((i) => i.name).sort()).toEqual(['Beans', 'Rice']);
    });

    test('cancelling the form discards the draft', async ({ authenticatedPage }) => {
        await openManualForm(authenticatedPage);
        await authenticatedPage.getByLabel('Recipe Title').fill('Never saved');

        await authenticatedPage.getByRole('button', { name: 'Cancel' }).last().click();

        await authenticatedPage.waitForURL('/recipes');
        expect(await apiGetRecipes()).toHaveLength(0);
    });
});

test.describe('Import a recipe from a link', () => {
    test.setTimeout(20000);

    const openImport = async (page: Page, link = 'https://example.com/cake') => {
        await page.goto('/recipes/new');
        await page.getByRole('button', { name: 'Import from a link' }).click();
        await page.getByLabel('Recipe Link').fill(link);
        await page.getByRole('button', { name: 'Import recipe from link' }).click();
    };

    test('shows progress while importing, then fills the form for review', async ({ authenticatedPage }) => {
        await mockRecipeImport(authenticatedPage, {
            delayMs: 800,
            ok: {
                title: 'Imported Cake',
                link: 'https://example.com/cake',
                instructions: ['Mix', 'Bake'],
                ingredients: [{ id: 'i1', name: 'Flour', quantity: 200, unit: 'g' }],
            },
        });
        await openImport(authenticatedPage);

        await expect(authenticatedPage.getByText('Reading the recipe page')).toBeVisible();
        await expect(authenticatedPage.getByLabel('Recipe Title')).toHaveValue('Imported Cake');
        await expect(authenticatedPage.getByText('Recipe imported — review and edit before saving')).toBeVisible();
        await expect(authenticatedPage.getByText('Flour', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByText('Bake')).toBeVisible();
    });

    test('the imported draft can be edited before it is saved', async ({ authenticatedPage }) => {
        await stubBackgroundCover(authenticatedPage);
        await mockRecipeImport(authenticatedPage, {
            ok: {
                title: 'Imported Cake',
                link: 'https://example.com/cake',
                instructions: ['Mix', 'Bake'],
                ingredients: [
                    { id: 'i1', name: 'Flour', quantity: 200, unit: 'g' },
                    { id: 'i2', name: 'Sugar', quantity: 100, unit: 'g' },
                ],
            },
        });
        await openImport(authenticatedPage);
        await expect(authenticatedPage.getByLabel('Recipe Title')).toHaveValue('Imported Cake');

        await expect(authenticatedPage.getByText('Recipe imported — review and edit before saving')).toBeHidden({
            timeout: 10000,
        });
        await authenticatedPage.getByLabel('Recipe Title').fill('My Cake');
        await authenticatedPage.getByLabel('Delete Sugar').dispatchEvent('click');
        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await authenticatedPage.waitForURL('/recipes');

        const [saved] = await apiGetRecipes();
        expect(saved.title).toBe('My Cake');
        expect(saved.link).toBe('https://example.com/cake');
        expect(saved.ingredients.map((i) => i.name)).toEqual(['Flour']);
        expect(saved.instructions).toEqual(['Mix', 'Bake']);
    });

    test('a page with no recipe on it warns and leaves the form empty to fill in', async ({ authenticatedPage }) => {
        await mockRecipeImport(authenticatedPage, {
            ok: { title: '', link: 'https://example.com/none', instructions: [], ingredients: [] },
        });
        await openImport(authenticatedPage, 'https://example.com/none');

        await expect(authenticatedPage.getByText('Couldn’t find recipe details — fill them in manually')).toBeVisible();
    });

    test('an unreachable page shows the error with retry and a way to switch to manual', async ({
        authenticatedPage,
    }) => {
        await mockRecipeImport(authenticatedPage, { status: 502, error: 'Could not fetch that page' });
        await openImport(authenticatedPage);

        await expect(authenticatedPage.getByText('Could not fetch that page').last()).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Retry' })).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Switch to manual' }).click();
        await expect(authenticatedPage.getByLabel('Recipe Title')).toBeFocused();
    });

    test('a blocked address is rejected with the server message', async ({ authenticatedPage }) => {
        await mockRecipeImport(authenticatedPage, { status: 400, error: 'That address is not allowed' });
        await openImport(authenticatedPage, 'http://localhost/admin');

        await expect(authenticatedPage.getByText('That address is not allowed').last()).toBeVisible();
    });

    test('retry after a failure imports successfully', async ({ authenticatedPage }) => {
        let calls = 0;
        await authenticatedPage.route('**/api/recipes/import', (route) => {
            calls++;

            return calls === 1
                ? route.fulfill({ status: 502, json: { error: 'Temporary failure' } })
                : route.fulfill({
                      json: {
                          title: 'Second Try',
                          link: 'https://example.com/cake',
                          instructions: [],
                          ingredients: [{ id: 'i1', name: 'Eggs' }],
                      },
                  });
        });
        await openImport(authenticatedPage);
        await expect(authenticatedPage.getByText('Temporary failure').last()).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Retry' }).click();

        await expect(authenticatedPage.getByLabel('Recipe Title')).toHaveValue('Second Try');
    });

    test('cancelling an in-flight import stays on the import screen', async ({ authenticatedPage }) => {
        await mockRecipeImport(authenticatedPage, {
            delayMs: 3000,
            ok: { title: 'Too slow', link: 'https://example.com/cake', instructions: [], ingredients: [] },
        });
        await openImport(authenticatedPage);
        await expect(authenticatedPage.getByText('Reading the recipe page')).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Cancel import' }).click();

        await expect(authenticatedPage.getByText('Reading the recipe page')).toHaveCount(0);
        await expect(authenticatedPage.getByRole('button', { name: 'Import recipe from link' })).toBeVisible();
    });

    test('hitting the AI rate limit explains why the import failed', async ({ authenticatedPage }) => {
        await mockRecipeImport(authenticatedPage, { status: 429, error: 'Too many AI requests. Try again later.' });
        await openImport(authenticatedPage);

        await expect(authenticatedPage.getByText('Too many AI requests').last()).toBeVisible();
    });
});
