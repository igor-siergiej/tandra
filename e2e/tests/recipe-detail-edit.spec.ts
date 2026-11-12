import type { Page } from '@playwright/test';

import { apiCreateRecipe, apiCreateRecipeAsOtherUser, apiGetRecipes } from '../api-helpers';
import { seedFriendship, seedRecipeImageKeys } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';

const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

test.describe.configure({ timeout: 20000 });

const openRecipe = async (page: Page, id: string) => {
    await page.goto(`/recipes/${id}`);
    await page.locator('h1').last().waitFor({ timeout: 10000 });
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

const savedRecipe = async (id: string) => (await apiGetRecipes()).find((r) => r.id === id);

test.describe('Recipe ingredients', () => {
    test('an ingredient with quantity and unit can be added', async ({ authenticatedPage, recipeDetailPage }) => {
        const recipe = await apiCreateRecipe('Pasta', [{ name: 'Spaghetti' }]);
        await openRecipe(authenticatedPage, recipe.id);

        await recipeDetailPage.openAddIngredientDrawer();
        await authenticatedPage.getByPlaceholder('Enter ingredient name...').fill('Parmesan');
        await authenticatedPage.getByLabel('Quantity').fill('50');
        await authenticatedPage.getByLabel('Unit').click();
        await authenticatedPage.getByRole('option', { name: 'g', exact: true }).click();
        await authenticatedPage.getByRole('button', { name: 'Add Ingredient' }).click();

        await expect(authenticatedPage.getByText('Parmesan', { exact: true })).toBeVisible();
        await authenticatedPage.reload();
        await expect(authenticatedPage.getByText('Parmesan', { exact: true })).toBeVisible();
        const saved = await savedRecipe(recipe.id);
        expect(saved?.ingredients.find((i) => i.name === 'Parmesan')).toMatchObject({ quantity: 50, unit: 'g' });
    });

    test('adding an ingredient with no name is rejected', async ({ authenticatedPage, recipeDetailPage }) => {
        const recipe = await apiCreateRecipe('Pasta');
        await openRecipe(authenticatedPage, recipe.id);

        await recipeDetailPage.openAddIngredientDrawer();
        await authenticatedPage.getByRole('button', { name: 'Add Ingredient' }).click();

        await expect(authenticatedPage.getByText(/name is required/i)).toBeVisible();
    });

    test('an ingredient can be edited from its swipe action', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Pasta', [{ name: 'Spaghetti', quantity: 200, unit: 'g' }]);
        await openRecipe(authenticatedPage, recipe.id);

        await swipeRow(authenticatedPage, 'Spaghetti', 90);
        await authenticatedPage.getByLabel('Edit Spaghetti').click();
        await authenticatedPage.getByLabel('Ingredient Name').fill('Linguine');
        await authenticatedPage.getByLabel('Quantity').fill('250');
        await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();

        await expect(authenticatedPage.getByText('Linguine', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByText('Spaghetti', { exact: true })).toHaveCount(0);
        await expect
            .poll(async () => (await savedRecipe(recipe.id))?.ingredients[0])
            .toMatchObject({ name: 'Linguine', quantity: 250, unit: 'g' });
    });

    test('an ingredient cannot be saved with a blank name', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Pasta', [{ name: 'Spaghetti' }]);
        await openRecipe(authenticatedPage, recipe.id);

        await swipeRow(authenticatedPage, 'Spaghetti', 90);
        await authenticatedPage.getByLabel('Edit Spaghetti').click();
        await authenticatedPage.getByLabel('Ingredient Name').fill('');

        await expect(authenticatedPage.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    });
});

test.describe('Editing the recipe', () => {
    test('steps can be removed and replaced from pasted text, then saved', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Toast', [], [], {
            instructions: ['Slice bread', 'Toast it', 'Butter it'],
        });

        await openRecipe(authenticatedPage, recipe.id);

        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByLabel('Remove step 2').click();
        await authenticatedPage.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(authenticatedPage.getByText('Toast it')).toHaveCount(0);
        await expect
            .poll(async () => (await savedRecipe(recipe.id))?.instructions)
            .toEqual(['Slice bread', 'Butter it']);

        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByRole('button', { name: 'paste text ↩' }).click();
        await authenticatedPage.getByPlaceholder(/Paste instructions here/).fill('Heat pan\nToast bread\nServe');
        await authenticatedPage.getByRole('button', { name: 'back to steps' }).click();
        await authenticatedPage.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(authenticatedPage.getByText('Serve', { exact: true })).toBeVisible();
        await expect
            .poll(async () => (await savedRecipe(recipe.id))?.instructions)
            .toEqual(['Heat pan', 'Toast bread', 'Serve']);
    });

    test('tags can be added and removed', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Toast', [], [], { tags: ['quick', 'breakfast'] });
        await openRecipe(authenticatedPage, recipe.id);
        await expect(authenticatedPage.getByText('quick', { exact: true })).toBeVisible();

        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByLabel('Remove tag quick').click();
        const tagInput = authenticatedPage.getByPlaceholder('Add a tag and press Enter...');
        await tagInput.fill('vegan');
        await tagInput.press('Enter');
        await authenticatedPage.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(authenticatedPage.getByText('vegan', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByText('quick', { exact: true })).toHaveCount(0);
        await expect.poll(async () => (await savedRecipe(recipe.id))?.tags?.sort()).toEqual(['breakfast', 'vegan']);
    });

    test('cancelling an edit discards the changes', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Original', [], [], { tags: ['keep'] });
        await openRecipe(authenticatedPage, recipe.id);

        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByLabel('Recipe title').fill('Changed');
        await authenticatedPage.getByLabel('Remove tag keep').click();
        await authenticatedPage.getByRole('button', { name: 'Cancel' }).first().click();

        await expect(authenticatedPage.locator('h1').filter({ hasText: 'Original' })).toBeVisible();
        await expect(authenticatedPage.getByText('keep', { exact: true })).toBeVisible();
        expect((await savedRecipe(recipe.id))?.title).toBe('Original');
    });

    test('a blank title cannot be saved', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Original');
        await openRecipe(authenticatedPage, recipe.id);

        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByLabel('Recipe title').fill('   ');
        await authenticatedPage.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(authenticatedPage.getByText('Recipe title is required')).toBeVisible();
        expect((await savedRecipe(recipe.id))?.title).toBe('Original');
    });
});

test.describe('Cover photo', () => {
    test('a photo can be uploaded and the owner is told it worked', async ({ authenticatedPage }) => {
        let uploads = 0;
        await authenticatedPage.route(/\/api\/recipes\/[^/]+\/image\/upload$/, (route) => {
            uploads++;

            return route.fulfill({ json: { imageKey: 'new-cover' } });
        });
        const recipe = await apiCreateRecipe('Toast');
        await openRecipe(authenticatedPage, recipe.id);
        await authenticatedPage.getByLabel('Edit recipe').click();

        await authenticatedPage
            .locator('input[type="file"]')
            .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG_1X1 });

        await expect(authenticatedPage.getByText('Image uploaded successfully')).toBeVisible();
        expect(uploads).toBe(1);
    });

    test('a rejected upload shows the server message', async ({ authenticatedPage }) => {
        await authenticatedPage.route(/\/api\/recipes\/[^/]+\/image\/upload$/, (route) =>
            route.fulfill({ status: 413, json: { error: 'Image is too large' } })
        );
        const recipe = await apiCreateRecipe('Toast');
        await openRecipe(authenticatedPage, recipe.id);
        await authenticatedPage.getByLabel('Edit recipe').click();

        await authenticatedPage
            .locator('input[type="file"]')
            .setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: PNG_1X1 });

        await expect(authenticatedPage.getByText('Image is too large')).toBeVisible();
    });

    test('after replacing an AI cover, the AI image can be restored', async ({ authenticatedPage }) => {
        let reverts = 0;
        await authenticatedPage.route(/\/api\/recipes\/[^/]+\/image\/revert$/, (route) => {
            reverts++;

            return route.fulfill({ json: {} });
        });
        const recipe = await apiCreateRecipe('Toast');
        await seedRecipeImageKeys(recipe.id, { coverImageKey: 'my-upload', aiImageKey: 'ai-cover' });
        await openRecipe(authenticatedPage, recipe.id);
        await authenticatedPage.getByLabel('Edit recipe').click();

        await authenticatedPage.getByRole('button', { name: 'Use AI image' }).click();

        await expect(authenticatedPage.getByText('Reverted to AI image')).toBeVisible();
        expect(reverts).toBe(1);
    });

    test('when the AI image is the cover there is nothing to restore', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Toast');
        await seedRecipeImageKeys(recipe.id, { coverImageKey: 'ai-cover', aiImageKey: 'ai-cover' });
        await openRecipe(authenticatedPage, recipe.id);
        await authenticatedPage.getByLabel('Edit recipe').click();

        await expect(authenticatedPage.getByRole('button', { name: 'Replace' })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Use AI image' })).toHaveCount(0);
    });
});

test.describe('Recipes shared by someone else', () => {
    test('are read-only: no edit, delete, add-ingredient or publish controls', async ({ authenticatedPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        const recipe = await apiCreateRecipeAsOtherUser('Their Stew', [MOCK_USER.id]);
        await openRecipe(authenticatedPage, recipe.id);

        await expect(authenticatedPage.locator('h1').filter({ hasText: 'Their Stew' })).toBeVisible();
        await expect(authenticatedPage.getByText('Shared flour', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByText('Shared step')).toBeVisible();
        await expect(authenticatedPage.getByLabel('Edit recipe')).toHaveCount(0);
        await expect(authenticatedPage.getByLabel('Delete recipe')).toHaveCount(0);
        await expect(authenticatedPage.getByText('Sharing publicly')).toHaveCount(0);
        await expect(authenticatedPage.getByText('Recipe Link', { exact: true })).toHaveCount(0);
    });

    test('appear in my recipes list and open from there', async ({ authenticatedPage, recipesPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await apiCreateRecipeAsOtherUser('Their Stew', [MOCK_USER.id]);
        await recipesPage.goto();

        await recipesPage.clickRecipe('Their Stew');

        await expect(authenticatedPage.locator('h1').filter({ hasText: 'Their Stew' })).toBeVisible();
    });
});

test.describe('Recipe that cannot be loaded', () => {
    test('an unknown recipe id shows the error state with a retry', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/recipes/does-not-exist');

        await expect(authenticatedPage.getByText('Unable to load recipe')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: /retry/i })).toBeVisible();
    });
});
