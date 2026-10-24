import { test as base, type Page } from '@playwright/test';
import { MongoClient } from 'mongodb';
import { signInAs, spreadAuthRateLimit } from '../auth';
import { resolveMongoUri } from '../mongo-uri';
import { DiscoverPage } from '../page-objects/DiscoverPage';
import { ItemsPage } from '../page-objects/ItemsPage';
import { ListsPage } from '../page-objects/ListsPage';
import { LoginPage } from '../page-objects/LoginPage';
import { RecipeDetailPage } from '../page-objects/RecipeDetailPage';
import { RecipesPage } from '../page-objects/RecipesPage';
import { RegisterPage } from '../page-objects/RegisterPage';
import { currentStack } from '../stack';

const MONGO_URI = resolveMongoUri();
const DB_NAME = currentStack.dbName;

interface Fixtures {
    authenticatedPage: Page;
    loginPage: LoginPage;
    registerPage: RegisterPage;
    listsPage: ListsPage;
    itemsPage: ItemsPage;
    recipesPage: RecipesPage;
    recipeDetailPage: RecipeDetailPage;
    discoverPage: DiscoverPage;
}

interface Options {
    /** Let the Umami tracker send. Off by default so e2e traffic, including the nightly @smoke run against production, stays out of Umami. */
    trackAnalytics: boolean;
}

export const test = base.extend<Fixtures & Options>({
    trackAnalytics: [false, { option: true }],

    // Each worker drives its own web server (see e2e/stack.ts); a live smoke run's E2E_BASE_URL still wins.
    baseURL: async ({ baseURL }, use) => {
        await use(process.env.E2E_BASE_URL ? baseURL : currentStack.webOrigin);
    },

    // Umami's tracker checks this flag before every send. Set on each document load, so a spec's localStorage.clear() can't undo it.
    context: async ({ context, trackAnalytics }, use) => {
        if (!trackAnalytics) await context.addInitScript(() => localStorage.setItem('umami.disabled', '1'));
        await use(context);
    },

    // Every page spreads its sign-in/sign-up calls over distinct client addresses (see e2e/auth.ts).
    page: async ({ page }, use) => {
        await spreadAuthRateLimit(page);
        await use(page);
    },

    authenticatedPage: async ({ page }, use) => {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        await db.collection('list').deleteMany({});
        await db.collection('recipe').deleteMany({});
        await db.collection('todo').deleteMany({});
        await db.collection('label').deleteMany({});
        await db.collection('mealPlan').deleteMany({});
        await db.collection('pairingCodes').deleteMany({});
        await db.collection('friendships').deleteMany({});
        // Publications and reports belong to the tests that make them; the library itself is seeded once (see global-setup).
        await db.collection('discoveryPublications').deleteMany({});
        await db.collection('discoveryReports').deleteMany({});
        await client.close();

        await signInAs(page);

        // The CI api runs without FAL_KEY, so /api/features reports every AI flag
        // as off. The web disables the corresponding controls in that case, which
        // would make AI-touching e2e specs unable to exercise the mocked
        // endpoints. Stub the endpoint to all-true so the controls stay enabled
        // and per-test route mocks (e.g. mockSubstitutes) can take over.
        await page.route('**/api/features', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    imageGeneration: true,
                    recipeImport: true,
                    ingredientSubstitutes: true,
                    itemCategorisation: true,
                    itemParse: true,
                    recipeTagger: true,
                }),
            })
        );

        // Prevent image fetch errors — images are not under test
        await page.route(/\/api\/image\//, (route) =>
            route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('GIF89a', 'ascii') })
        );

        await use(page);
    },

    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    registerPage: async ({ page }, use) => {
        await use(new RegisterPage(page));
    },

    listsPage: async ({ authenticatedPage }, use) => {
        await use(new ListsPage(authenticatedPage));
    },

    itemsPage: async ({ authenticatedPage }, use) => {
        await use(new ItemsPage(authenticatedPage));
    },

    recipesPage: async ({ authenticatedPage }, use) => {
        await use(new RecipesPage(authenticatedPage));
    },

    recipeDetailPage: async ({ authenticatedPage }, use) => {
        await use(new RecipeDetailPage(authenticatedPage));
    },

    discoverPage: async ({ authenticatedPage }, use) => {
        await use(new DiscoverPage(authenticatedPage));
    },
});

export { expect } from '@playwright/test';
