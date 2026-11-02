import type { DiscoveryRecipeSummary } from '@tandra/types';

import { apiGetRecipes } from '../api-helpers';
import { E2E_OPENSEARCH_URL } from '../db-helpers';
import { expect, test } from '../fixtures';

test.skip(!E2E_OPENSEARCH_URL, 'needs E2E_OPENSEARCH_URL (a dedicated OpenSearch for e2e)');

test.describe('Discover: empty and paged results', () => {
    test('filters that nothing satisfies show the empty state, and Clear filters lifts them', async ({
        authenticatedPage,
        discoverPage,
    }) => {
        await discoverPage.goto();
        await expect(discoverPage.card('Lemon Drizzle Cake')).toBeVisible();
        await discoverPage.openFilters();
        await discoverPage.filterChip(/^Easy 3$/).click();

        await discoverPage.searchInput.fill('wellington');

        await expect(authenticatedPage.getByText('No recipes found')).toBeVisible();
        await expect(authenticatedPage.getByText('Try a different search term or fewer filters')).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Clear filters' }).last().click();

        await expect(discoverPage.card('Beef Wellington')).toBeVisible();
        await expect(authenticatedPage.getByText('No recipes found')).toHaveCount(0);
        await expect(discoverPage.filtersButton).toHaveText('Filters');
    });

    test('a search nothing matches shows the empty state without a filter reset', async ({
        authenticatedPage,
        discoverPage,
    }) => {
        await discoverPage.goto();
        await discoverPage.searchInput.fill('zzzqqqxxx');

        await expect(authenticatedPage.getByText('No recipes found')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    });

    test('Load more appends the next page of results', async ({ authenticatedPage, discoverPage }) => {
        const hit = (n: number): DiscoveryRecipeSummary => ({
            id: `paged-${n}`,
            title: `Paged Recipe ${n}`,
            tags: [],
            source: 'wikibooks',
        });
        const facets = { tags: [], difficulty: [], source: [], ingredients: [], time: [] };
        await authenticatedPage.route(/\/api\/discover\/recipes(\?|$)/, (route) => {
            const page = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
            return route.fulfill({
                json: {
                    hits: page === 1 ? [hit(1), hit(2)] : [hit(3)],
                    total: 3,
                    page,
                    pageSize: 2,
                    facets,
                },
            });
        });

        await discoverPage.goto();
        await expect(discoverPage.card('Paged Recipe 2')).toBeVisible();
        await expect(discoverPage.card('Paged Recipe 3')).toHaveCount(0);

        await authenticatedPage.getByRole('button', { name: 'Load more' }).click();

        await expect(discoverPage.card('Paged Recipe 3')).toBeVisible();
        await expect(discoverPage.card('Paged Recipe 1')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Load more' })).toHaveCount(0);
    });
});

test.describe('Discover: opening a recipe directly', () => {
    test('a link to a recipe that is not in the library says it was not found', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/discover/no-such-recipe');

        await expect(authenticatedPage.getByRole('alert')).toContainText('Recipe not found');
        await expect(authenticatedPage.getByText('It is no longer in the library.')).toBeVisible();
    });

    test('a link to a library recipe works without going through search', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/discover/e2e-library-1');

        await expect(authenticatedPage.getByRole('heading', { name: 'Lemon Drizzle Cake' })).toBeVisible();
    });
});

test.describe('Discover: reporting a recipe', () => {
    test('sends the reason and thanks the user', async ({ authenticatedPage }) => {
        let reported: { reason?: string } | undefined;
        authenticatedPage.on('request', (req) => {
            if (/\/api\/discover\/recipes\/[^/]+\/report$/.test(req.url()) && req.method() === 'POST') {
                reported = req.postDataJSON();
            }
        });
        await authenticatedPage.goto('/discover/e2e-library-1');

        await authenticatedPage.getByRole('button', { name: 'Report' }).click();
        await authenticatedPage.getByLabel('Reason for the report').fill('Looks like spam');
        await authenticatedPage.getByRole('button', { name: 'Send report' }).click();

        await expect(authenticatedPage.getByText("Thanks, we'll take a look.")).toBeVisible();
        expect(reported).toEqual({ reason: 'Looks like spam' });
    });

    test('a failed report keeps the dialog open with an error', async ({ authenticatedPage }) => {
        await authenticatedPage.route(/\/api\/discover\/recipes\/[^/]+\/report$/, (route) =>
            route.fulfill({ status: 500, json: { error: 'boom' } })
        );
        await authenticatedPage.goto('/discover/e2e-library-1');

        await authenticatedPage.getByRole('button', { name: 'Report' }).click();
        await authenticatedPage.getByRole('button', { name: 'Send report' }).click();

        await expect(authenticatedPage.getByText('Could not send the report. Please try again.')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Send report' })).toBeVisible();
    });

    test('cancelling sends nothing', async ({ authenticatedPage }) => {
        let sent = 0;
        authenticatedPage.on('request', (req) => {
            if (req.url().endsWith('/report') && req.method() === 'POST') sent++;
        });
        await authenticatedPage.goto('/discover/e2e-library-1');

        await authenticatedPage.getByRole('button', { name: 'Report' }).click();
        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await expect(authenticatedPage.getByRole('button', { name: 'Send report' })).toHaveCount(0);
        expect(sent).toBe(0);
    });
});

test.describe('Discover: editing a copy', () => {
    test('editing my copy keeps its attribution and leaves the library recipe unchanged', async ({
        authenticatedPage,
    }) => {
        await authenticatedPage.goto('/discover/e2e-library-1');
        await authenticatedPage.getByRole('button', { name: 'Add to my recipes' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'Added to your recipes' })).toBeDisabled();

        const [copy] = await apiGetRecipes();
        await authenticatedPage.goto(`/recipes/${copy.id}`);
        await authenticatedPage.locator('h1').last().waitFor({ timeout: 10000 });
        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByLabel('Recipe title').fill('My Lemon Cake');
        await authenticatedPage.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(authenticatedPage.locator('h1').filter({ hasText: 'My Lemon Cake' })).toBeVisible();
        await expect(authenticatedPage.getByText(/from Wikibooks Cookbook, CC BY-SA 4\.0/)).toBeVisible();

        await authenticatedPage.goto('/discover/e2e-library-1');
        await expect(authenticatedPage.getByRole('heading', { name: 'Lemon Drizzle Cake' })).toBeVisible();
    });
});
