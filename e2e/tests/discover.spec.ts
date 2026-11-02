import { E2E_OPENSEARCH_URL } from '../db-helpers';
import { expect, test } from '../fixtures';

// The library is seeded into a dedicated OpenSearch (E2E_OPENSEARCH_URL) by global-setup; without one there is
// nothing to search, so these specs sit out rather than fail.
test.skip(!E2E_OPENSEARCH_URL, 'needs E2E_OPENSEARCH_URL (a dedicated OpenSearch for e2e)');

test.describe('Discover', () => {
    test('is reachable from the Recipes page and lists the library', async ({ authenticatedPage, discoverPage }) => {
        await discoverPage.openFromRecipes();

        await authenticatedPage.waitForURL(/\/discover$/);
        await expect(discoverPage.heading).toBeVisible();
        await expect(authenticatedPage.getByText('6 recipes')).toBeVisible();

        for (const title of ['Lemon Drizzle Cake', 'Chocolate Brownies', 'Beef Wellington']) {
            await expect(discoverPage.card(title)).toBeVisible();
        }
    });

    test('finds a recipe by name even with a typo', async ({ discoverPage }) => {
        await discoverPage.goto();
        await discoverPage.searchInput.fill('lemmon');

        await expect(discoverPage.card('Lemon Drizzle Cake')).toBeVisible();
        await expect(discoverPage.card('Beef Wellington')).not.toBeVisible();
    });

    test('finds a recipe through an ingredient synonym', async ({ discoverPage }) => {
        await discoverPage.goto();
        await discoverPage.searchInput.fill('eggplant');

        await expect(discoverPage.card('Aubergine Parmigiana')).toBeVisible();
        await expect(discoverPage.card('Lemon Drizzle Cake')).not.toBeVisible();
    });

    test('narrows the results with facet filters driven by counts', async ({ authenticatedPage, discoverPage }) => {
        await discoverPage.goto();
        await expect(discoverPage.card('Lemon Drizzle Cake')).toBeVisible();
        await discoverPage.openFilters();

        // Three of the six fixtures are easy.
        await discoverPage.filterChip(/^Easy 3$/).click();
        await expect(discoverPage.card('Quick Tomato Soup')).toBeVisible();
        await expect(discoverPage.card('Vanilla Sponge Cake')).toBeVisible();
        await expect(discoverPage.card('Chocolate Brownies')).not.toBeVisible();

        // Only the soup is under 15 minutes in total.
        await discoverPage.filterChip(/^Under 15 min 1$/).click();
        await expect(discoverPage.card('Quick Tomato Soup')).toBeVisible();
        await expect(discoverPage.card('Lemon Drizzle Cake')).not.toBeVisible();
        await expect(discoverPage.filtersButton).toHaveText(/Filters \(2\)/);

        await authenticatedPage.getByRole('button', { name: 'Clear filters' }).first().click();
        await expect(discoverPage.card('Beef Wellington')).toBeVisible();
    });

    test('filters by tag and by ingredient', async ({ discoverPage }) => {
        await discoverPage.goto();
        await expect(discoverPage.card('Lemon Drizzle Cake')).toBeVisible();
        await discoverPage.openFilters();

        await discoverPage.filterChip(/^dessert 3$/, 'Tags').click();
        await expect(discoverPage.card('Chocolate Brownies')).toBeVisible();
        await expect(discoverPage.card('Beef Wellington')).not.toBeVisible();

        // Only the lemon cake has lemon as an ingredient ("lemon" is also a tag, hence the group).
        await discoverPage.filterChip(/^lemon 1$/, 'Ingredients').click();
        await expect(discoverPage.card('Lemon Drizzle Cake')).toBeVisible();
        await expect(discoverPage.card('Chocolate Brownies')).not.toBeVisible();
    });

    test('previews a recipe with estimated values marked, its attribution and similar recipes', async ({
        authenticatedPage,
        discoverPage,
    }) => {
        await discoverPage.goto();
        await discoverPage.card('Lemon Drizzle Cake').click();

        await authenticatedPage.waitForURL(/\/discover\/e2e-library-1$/);
        await expect(authenticatedPage.getByRole('heading', { name: 'Lemon Drizzle Cake' })).toBeVisible();
        await expect(authenticatedPage.getByText('175 g butter')).toBeVisible();
        await expect(authenticatedPage.getByText('Fold in the lemon zest and flour.')).toBeVisible();

        // Prep time was estimated; cook time was read from the source.
        await expect(authenticatedPage.getByText('≈15m prep')).toBeVisible();
        await expect(authenticatedPage.getByText('40m cook')).toBeVisible();
        await expect(authenticatedPage.getByText(/estimated, not stated in the original recipe/)).toBeVisible();

        const source = authenticatedPage.getByRole('region', { name: 'Source' });
        await expect(source).toContainText('from Wikibooks Cookbook, CC BY-SA 4.0');
        await expect(source.getByRole('link', { name: /View the original recipe/ })).toHaveAttribute(
            'href',
            'https://en.wikibooks.org/wiki/Cookbook:Lemon_Drizzle_Cake'
        );

        const similar = authenticatedPage.getByRole('region', { name: 'Similar recipes' });
        await expect(similar.getByRole('button', { name: /Vanilla Sponge Cake/ })).toBeVisible();
    });

    test("shows a recipe's cover picture in results and the preview, credited with its licence", async ({
        authenticatedPage,
        discoverPage,
    }) => {
        await discoverPage.goto();
        const card = discoverPage.card('Chocolate Brownies');
        await expect(card.locator('img[alt="Chocolate Brownies"]')).toBeAttached();
        // A recipe without a cover has no picture slot at all.
        await expect(discoverPage.card('Lemon Drizzle Cake').locator('img')).toHaveCount(0);

        await card.click();

        await authenticatedPage.waitForURL(/\/discover\/e2e-library-2$/);
        await expect(authenticatedPage.locator('img[alt="Chocolate Brownies"]')).toBeAttached();

        const credit = authenticatedPage.getByRole('link', {
            name: /Photo: Jane Doe, CC BY 2\.0, via Wikimedia Commons/,
        });

        await expect(credit).toBeVisible();
        await expect(credit).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Chocolate_brownies.jpg');
    });

    test('adds a recipe to my recipes in one tap, keeps its attribution, and does not add it twice', async ({
        authenticatedPage,
    }) => {
        await authenticatedPage.goto('/discover/e2e-library-1');
        await authenticatedPage.getByRole('button', { name: 'Add to my recipes' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'Added to your recipes' })).toBeDisabled();

        await authenticatedPage.goto('/recipes');
        await authenticatedPage.getByRole('button', { name: /Lemon Drizzle Cake/ }).click();
        await expect(authenticatedPage.locator('h1').filter({ hasText: 'Lemon Drizzle Cake' })).toBeVisible();
        await expect(authenticatedPage.getByText(/from Wikibooks Cookbook, CC BY-SA 4\.0/)).toBeVisible();

        await authenticatedPage.goto('/discover/e2e-library-1');
        await expect(authenticatedPage.getByRole('button', { name: 'Already in your recipes' })).toBeDisabled();
        await expect(authenticatedPage.getByRole('button', { name: 'Add to my recipes' })).toHaveCount(0);
    });

    test('shows a clear error state when discovery is unavailable, and the rest of the app still works', async ({
        authenticatedPage,
        discoverPage,
    }) => {
        await authenticatedPage.route(/\/api\/discover\/recipes/, (route) =>
            route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Recipe discovery is temporarily unavailable' }),
            })
        );

        await discoverPage.goto();
        await expect(authenticatedPage.getByRole('alert')).toContainText('Recipe discovery is unavailable');

        await authenticatedPage.goto('/recipes');
        await expect(authenticatedPage.getByText('No recipes yet')).toBeVisible();
    });
});
