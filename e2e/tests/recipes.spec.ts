import { apiCreateRecipe } from '../api-helpers';
import { expect, test } from '../fixtures';

test.describe('Recipes page', () => {
    test('shows empty state when there are no recipes', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/recipes');
        await expect(authenticatedPage.getByText('No recipes yet')).toBeVisible();
    });

    test('renders owned recipe cards', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Pasta Bolognese');
        await apiCreateRecipe('Caesar Salad');
        await authenticatedPage.goto('/recipes');
        await expect(authenticatedPage.getByRole('button', { name: 'Pasta Bolognese' })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Caesar Salad' })).toBeVisible();
    });

    test('search filters recipes', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Pasta Bolognese');
        await apiCreateRecipe('Caesar Salad');
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByPlaceholder('Search recipes...').fill('pasta');
        await expect(authenticatedPage.getByRole('button', { name: 'Pasta Bolognese' })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Caesar Salad' })).not.toBeVisible();
    });

    test('clear search shows all recipes', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Pasta Bolognese');
        await apiCreateRecipe('Caesar Salad');
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByPlaceholder('Search recipes...').fill('pasta');
        await authenticatedPage.getByLabel('Clear search').click();
        await expect(authenticatedPage.getByRole('button', { name: 'Pasta Bolognese' })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Caesar Salad' })).toBeVisible();
    });

    test('search field stays pinned near the bottom of the viewport', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Pasta Bolognese');
        await authenticatedPage.setViewportSize({ width: 390, height: 700 });
        await authenticatedPage.goto('/recipes');

        const searchInput = authenticatedPage.getByPlaceholder('Search recipes...');
        const box = await searchInput.boundingBox();

        if (!box) throw new Error('search input has no bounding box');
        // Pinned to the bottom of the page, not scrolled away above the fold.
        expect(box.y).toBeGreaterThan(500);
    });

    test('best search match renders closest to the bottom-pinned search field', async ({ authenticatedPage }) => {
        // Exact title match scores best and should land last, nearest the search field;
        // the ingredient-only match should render first, furthest from the field.
        await apiCreateRecipe('Curry Night Special', [{ name: 'chicken curry paste' }]);
        await apiCreateRecipe('Chicken Curry');
        await authenticatedPage.setViewportSize({ width: 390, height: 700 });
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByPlaceholder('Search recipes...').fill('Chicken Curry');

        const bestMatch = authenticatedPage.getByRole('button', { name: 'Chicken Curry' });
        const worseMatch = authenticatedPage.getByRole('button', { name: 'Curry Night Special' });
        await expect(bestMatch).toBeVisible();
        await expect(worseMatch).toBeVisible();

        const bestBox = await bestMatch.boundingBox();
        const worseBox = await worseMatch.boundingBox();

        if (!bestBox) throw new Error('best match has no bounding box');

        if (!worseBox) throw new Error('worse match has no bounding box');
        expect(bestBox.y).toBeGreaterThan(worseBox.y);
    });

    test('clearing search scrolls the page back to the bottom', async ({ authenticatedPage }) => {
        for (let i = 0; i < 15; i++) {
            await apiCreateRecipe(`Recipe ${i}`);
        }

        await authenticatedPage.setViewportSize({ width: 390, height: 700 });
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByPlaceholder('Search recipes...').fill('Recipe 1');

        const scrollContainer = authenticatedPage.locator('div.overflow-y-auto');
        await scrollContainer.evaluate((el) => el.scrollTo({ top: 0 }));
        await authenticatedPage.getByLabel('Clear search').click();

        await expect
            .poll(async () => scrollContainer.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2))
            .toBe(true);
    });

    test('clicking recipe navigates to detail page', async ({ authenticatedPage }) => {
        const recipe = await apiCreateRecipe('Pasta Bolognese');
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByRole('button', { name: 'Pasta Bolognese' }).click();
        await authenticatedPage.waitForURL(`/recipes/${recipe.id}`);
    });

    test('can add a new recipe', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Create Recipe' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Add manually' }).click();
        await authenticatedPage.getByLabel('Recipe Title').fill('New Dish');
        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'New Dish' })).toBeVisible();
    });

    test('typing a URL into the manual link field does not trigger import', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await authenticatedPage.getByRole('button', { name: 'Add manually' }).click();
        await authenticatedPage.getByLabel('Recipe Title').fill('URL Field Test');
        await authenticatedPage.getByPlaceholder('https://...').fill('https://example.com/some-recipe');

        // No import UI (spinner/error banner/metadata chips) fires as a side effect of typing.
        await expect(authenticatedPage.getByRole('button', { name: 'Cancel import' })).not.toBeVisible();
        await expect(authenticatedPage.getByText(/failed to import/i)).not.toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Create Recipe' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'URL Field Test' })).toBeVisible();
    });

    test('navigate to lists via toolbar', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByRole('button', { name: 'Shopping lists' }).click();
        await authenticatedPage.waitForURL('/');
    });
});
