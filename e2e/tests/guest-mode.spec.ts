import { expect, test } from '../fixtures';

// Guest mode lets a stranger try Tandra without an account. Their lists
// and items live in IndexedDB only, so the flow can only be exercised with
// a clean browser context (no pre-seeded access token). The acceptance
// criterion is "guest creates a list with items, registers, and the list
// exists server-side after reload" — verified end-to-end here.

type ServerItem = { id: string; name: string; isSelected: boolean; dateAdded: string };

type ServerList = {
    id: string;
    title: string;
    items: Array<ServerItem>;
    users: unknown[];
    listType: string;
    ownerId: string;
    dateAdded: string;
};

test.describe('Guest mode', () => {
    // Tiny in-memory "server" behind the mocked list endpoints; reset per test.
    let serverLists: Array<ServerList> = [];

    test.beforeEach(async ({ page }) => {
        // Match `authenticatedPage`'s image/features stubs so guest-mode pages
        // that happen to fetch images don't make the suite flaky.
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
        await page.route(/\/api\/image\//, (route) =>
            route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('GIF89a', 'ascii') })
        );

        // The e2e runner only starts the web server. The migration after
        // sign-up hits the API directly, so mock the relevant endpoints and
        // keep a tiny in-memory "server" so the post-reload GET surfaces the
        // list the migration supposedly created. The web's `makeRequest` issues
        // PUT to /api/lists and /api/lists/:title/items, and POST to
        // /api/lists/:title/items/:id to re-tick migrated items.
        serverLists = [];
        let serverListCounter = 0;
        let serverItemCounter = 0;
        await page.route('**/api/lists', async (route) => {
            if (route.request().method() === 'PUT') {
                const payload = route.request().postDataJSON?.() ?? {};
                const id = `server-list-${++serverListCounter}`;

                const created = {
                    id,
                    title: payload.title ?? 'Untitled',
                    items: [],
                    users: [],
                    listType: payload.listType ?? 'shopping',
                    ownerId: 'user-testuser',
                    dateAdded: new Date().toISOString(),
                };

                serverLists.push(created);
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });

                return;
            }

            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        });
        await page.route(/\/api\/lists\/title\//, (route) => {
            const url = new URL(route.request().url());
            // The app routes server lists by id (`/list/:id`) and fetches them
            // through this endpoint, so the key may be either.
            const key = decodeURIComponent(url.pathname.split('/').pop() ?? '');
            const list = serverLists.find((candidate) => candidate.id === key || candidate.title === key);
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(
                    list ?? {
                        listType: 'shopping',
                        items: [],
                        users: [],
                        ownerId: 'user-testuser',
                    }
                ),
            });
        });
        await page.route('**/api/lists/*/items', async (route) => {
            if (route.request().method() === 'PUT') {
                const url = new URL(route.request().url());
                const title = decodeURIComponent(url.pathname.split('/').slice(-2, -1)[0] ?? '');
                const payload = route.request().postDataJSON?.() ?? {};
                const target = serverLists.find((list) => list.title === title);
                const id = payload.id ?? `server-item-${++serverItemCounter}`;

                const created: ServerItem = {
                    id,
                    name: payload.itemName ?? '',
                    isSelected: false,
                    dateAdded: new Date().toISOString(),
                };

                target?.items.push(created);
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });

                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ added: 0, skipped: 0 }),
            });
        });
        await page.route(/\/api\/lists\/[^/]+\/items\/[^/]+$/, async (route) => {
            if (route.request().method() !== 'POST') return route.fallback();
            const segments = new URL(route.request().url()).pathname.split('/');
            const title = decodeURIComponent(segments.at(-3) ?? '');
            const itemId = decodeURIComponent(segments.at(-1) ?? '');

            const item = serverLists
                .find((list) => list.title === title)
                ?.items.find((candidate) => candidate.id === itemId);

            if (item) item.isSelected = route.request().postDataJSON()?.isSelected ?? item.isSelected;
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item ?? {}) });
        });
        await page.route(/\/api\/lists\/user\//, (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(serverLists) })
        );

        // Fresh IDB so the run starts with no leftover guest lists.
        await page.goto('/');
        await page.evaluate(async () => {
            const dbs = (await indexedDB.databases?.()) ?? [];
            await Promise.all(
                dbs.map(
                    (db) =>
                        new Promise<void>((resolve) => {
                            if (!db.name) return resolve();
                            const req = indexedDB.deleteDatabase(db.name);
                            req.onsuccess = () => resolve();
                            req.onerror = () => resolve();
                            req.onblocked = () => resolve();
                        })
                )
            );
            localStorage.clear();
        });
    });

    test('@smoke /try deep link from the landing site opens a guest session', async ({ page }) => {
        await page.goto('/try');
        await page.waitForURL((url) => url.pathname === '/');
        await expect(page.getByTestId('guest-mode-indicator').getByRole('button', { name: 'Sign up' })).toBeVisible();
        await expect(page.getByText('No lists yet')).toBeVisible();
    });

    // Guests can't generate item images (the API needs a session to pay for one), so their
    // lists are a plain checklist rather than a column of broken-image icons.
    test('guest list items render as a plain checklist without fetching images', async ({ page }) => {
        const imageRequests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/image/')) imageRequests.push(request.url());
        });

        await page.goto('/try');
        await page.waitForURL((url) => url.pathname === '/');
        await expect(page.getByText('No lists yet')).toBeVisible();
        await page.locator('button[class*="border-primary"]').first().click();
        await page.getByLabel('List Name').fill('Plain');
        await page.getByRole('button', { name: 'Add List' }).click();
        await page.getByRole('button', { name: 'Plain' }).click();
        await page.waitForURL(/\/list\/[^/]+$/);
        await expect(page.getByText('No items yet')).toBeVisible();

        await page.locator('button[class*="border-primary"]').first().click();
        await page.getByPlaceholder('Enter item name...').fill('Pencils');
        await page.getByRole('button', { name: 'Add Item' }).click();

        const row = page.getByRole('button', { name: 'Pencils', exact: true });
        await expect(row.getByTestId('item-check')).toBeVisible();
        await expect(row.locator('img')).toHaveCount(0);
        expect(imageRequests).toEqual([]);
    });

    // Not @smoke: registration would hit the real auth service on a live run.
    test('try-it → create list → open it from the lists page → add items → sign up → list survives reload', async ({
        page,
    }) => {
        // The full flow covers guest IDB writes, sign-up, the migration that
        // hits the mocked server, and a reload — well past the 8s default.
        test.setTimeout(30_000);

        await page.goto('/login');

        // Land in guest mode via the new entry point.
        await page.getByTestId('try-it-button').click();
        await page.waitForURL('/');
        await expect(page.getByTestId('guest-mode-indicator')).toBeVisible();

        // Create a list "Groceries". Guests can't share, so the drawer has no friend picker.
        await page.locator('button[class*="border-primary"]').first().click();
        await expect(page.getByText('Share with')).toHaveCount(0);
        await page.getByLabel('List Name').fill('Groceries');
        await page.getByRole('button', { name: 'Add List' }).click();

        // Like a signed-in user, the guest stays on the lists page and opens the list from its card.
        await page.getByRole('button', { name: 'Groceries' }).click();
        await page.waitForURL(/\/list\/[^/]+$/);
        // The signed-in items page's empty state, not "Unable to load items" or the sign-up wall.
        await expect(page.getByText('No items yet')).toBeVisible();

        // The real items page and add-item drawer.
        await page.locator('button[class*="border-primary"]').first().click();
        await page.getByPlaceholder('Enter item name...').fill('Apples');
        await page.getByRole('button', { name: 'Add Item' }).click();
        await expect(page.getByText('Apples')).toBeVisible();

        // A reload starts with an empty in-memory mirror: the guest's list
        // and item must come back from IndexedDB.
        await page.reload();
        await expect(page.getByText('Apples')).toBeVisible();

        // Tick the item, and let the write land in IndexedDB before leaving the page.
        await page.getByText('Apples').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        new Promise<boolean>((resolve) => {
                            const open = indexedDB.open('tandra-guest');
                            open.onsuccess = () => {
                                const db = open.result;
                                const read = db.transaction('items').objectStore('items').getAll();
                                read.onsuccess = () => {
                                    db.close();
                                    resolve(read.result.some((item) => item.name === 'Apples' && item.isSelected));
                                };
                            };
                        })
                )
            )
            .toBe(true);

        // Sign up from the app bar.
        await page.getByTestId('guest-mode-indicator').getByRole('button', { name: 'Sign up' }).click();
        await page.waitForURL('/register');
        // Reload so the register page starts with a cold in-memory store: the
        // migration must read the guest data back from IndexedDB itself.
        await page.reload();

        await page.getByLabel('Username').fill(`guest${Date.now()}`);
        await page.getByLabel('Password', { exact: true }).fill('password123');
        await page.getByLabel('Repeat Password').fill('password123');
        await page.getByRole('button', { name: /create account/i }).click();

        // After the migration the user lands on / and the list is now server-side.
        await page.waitForURL('/');
        await expect(page.getByRole('button', { name: 'Groceries' })).toBeVisible();

        // Reload and confirm the list survives the round-trip — proving the
        // migration actually wrote it to Mongo, not just to a fresh IDB cache.
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByRole('button', { name: 'Groceries' })).toBeVisible({
            timeout: 15_000,
        });

        // Open the list and confirm the item plus its ticked state are there.
        await page.getByRole('button', { name: 'Groceries' }).click();
        await page.waitForURL(/\/list\//);
        await expect(page.getByText('Apples')).toBeVisible({ timeout: 15_000 });
        // The authenticated row has no checkbox role; check the ticked state
        // reached the server, as the other item specs do.
        expect(serverLists[0]?.items).toEqual([expect.objectContaining({ name: 'Apples', isSelected: true })]);
    });
});
