import { apiAddItem, apiCreateList, apiCreateRecipe } from '../api-helpers';
import { expect, test } from '../fixtures';

test.describe('Bulk add ingredients to list', () => {
    test('Add to shopping list button enters select mode', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('My Recipe', [{ name: 'Flour' }, { name: 'Eggs' }]);
        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add to Shopping List' }).click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Select Ingredients' })).toBeVisible();
    });

    test('can select ingredients and add to list', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Cake', [{ name: 'Flour' }, { name: 'Eggs' }, { name: 'Butter' }]);
        await apiCreateList('Groceries');
        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add to Shopping List' }).click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Select Ingredients' })).toBeVisible();

        await authenticatedPage.getByText('Flour').click();
        await authenticatedPage.getByText('Eggs').click();

        await expect(authenticatedPage.getByRole('heading', { name: 'Add to List' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Groceries' }).click();

        await authenticatedPage.getByRole('button', { name: /Add 2 items/ }).click();

        await expect(authenticatedPage.getByText(/2 items added/)).toBeVisible();
    });

    test('cancel exits select mode', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('My Recipe', [{ name: 'Flour' }]);
        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add to Shopping List' }).click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Select Ingredients' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await expect(authenticatedPage.locator('h1').filter({ hasText: 'My Recipe' })).toBeVisible();
        await expect(authenticatedPage.getByRole('heading', { name: 'Select Ingredients' })).not.toBeVisible();
    });

    test('skips already-existing items and shows skipped count', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Cake', [{ name: 'Flour' }]);
        await apiCreateList('Groceries');
        await apiAddItem('Groceries', 'Flour');

        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add to Shopping List' }).click();
        await authenticatedPage.getByText('Flour').click();
        await authenticatedPage.getByRole('button', { name: 'Groceries' }).click();
        await authenticatedPage.getByRole('button', { name: /Add 1 items/ }).click();

        await expect(authenticatedPage.getByText(/0 items added.*1 skipped|1 skipped/)).toBeVisible();
    });
});

test.describe('Merging near-duplicate ingredients', () => {
    test('combines a near-duplicate ingredient into the existing list item instead of a second row', async ({
        authenticatedPage,
    }) => {
        const recipe = await apiCreateRecipe('Omelette', [{ name: 'large eggs', quantity: 2 }]);
        await apiCreateList('Groceries');
        await apiAddItem('Groceries', 'eggs', { quantity: 5, unit: 'pcs' });

        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add to Shopping List' }).click();
        await authenticatedPage.getByText('large eggs').click();
        await authenticatedPage.getByRole('button', { name: 'Groceries' }).click();
        await authenticatedPage.getByRole('button', { name: /Add 1 items/ }).click();

        await expect(authenticatedPage.getByText(/skipped/)).toBeVisible();

        await authenticatedPage.goto('/list/Groceries');
        await expect(authenticatedPage.getByText('eggs', { exact: true })).toHaveCount(1);
        await expect(authenticatedPage.getByText('7 pcs')).toBeVisible();
        await expect(authenticatedPage.getByText('large eggs')).not.toBeVisible();
    });
});

test.describe('Portions scaling', () => {
    test('defaults to recipe servings, scales quantities live, and sends the scaled amount', async ({
        authenticatedPage,
    }) => {
        const recipe = await apiCreateRecipe('Soup', [{ name: 'Carrot', quantity: 2, unit: 'cups' }], [], {
            servings: 4,
        });

        await apiCreateList('Groceries');
        await authenticatedPage.goto(`/recipes/${recipe.id}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add to Shopping List' }).click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Select Ingredients' })).toBeVisible();

        await expect(authenticatedPage.getByTestId('portions-value')).toHaveText('4');
        await expect(authenticatedPage.getByText('2 cups')).toBeVisible();

        await authenticatedPage.getByLabel('Increase portions').click();
        await expect(authenticatedPage.getByTestId('portions-value')).toHaveText('5');
        await expect(authenticatedPage.getByText('2.5 cups')).toBeVisible();

        await authenticatedPage.getByText('Carrot').click();
        await authenticatedPage.getByRole('button', { name: 'Groceries' }).click();
        await authenticatedPage.getByRole('button', { name: /Add 1 items/ }).click();

        await authenticatedPage.goto('/list/Groceries');
        await expect(authenticatedPage.getByText('2.5 cups')).toBeVisible();
    });
});
