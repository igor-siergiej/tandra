import { apiAddItem, apiCreateList, apiGetList, apiSetItemCategory } from '../api-helpers';
import { expect, test } from '../fixtures';

const LIST_TITLE = 'Edge Cases';

test.describe('Add item validation', () => {
    test('an empty name is rejected and the drawer stays open', async ({ authenticatedPage, itemsPage }) => {
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await itemsPage.openAddItemDrawer();
        await itemsPage.addItemSubmit.click();

        await expect(authenticatedPage.getByText('Item name is required')).toBeVisible();
        await expect(itemsPage.addItemDrawerTitle).toBeVisible();
    });

    test('a whitespace-only name is rejected', async ({ authenticatedPage, itemsPage }) => {
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await itemsPage.openAddItemDrawer();
        await itemsPage.itemNameInput.fill('   ');
        await itemsPage.addItemSubmit.click();

        await expect(authenticatedPage.getByText('Item name is required')).toBeVisible();
    });

    test('the item name is trimmed before it is added', async ({ itemsPage }) => {
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await itemsPage.addItem('  Oat milk  ');

        await expect(itemsPage.itemRow('Oat milk')).toBeVisible();
        await expect.poll(async () => (await apiGetList(LIST_TITLE)).items.map((i) => i.name)).toEqual(['Oat milk']);
    });

    test('a very long name is stored and rendered without breaking the page', async ({ itemsPage }) => {
        const longName = 'Extra long organic free range '.repeat(6).trim();
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await itemsPage.addItem(longName);

        await expect(itemsPage.itemRow(longName)).toBeVisible();
        await expect.poll(async () => (await apiGetList(LIST_TITLE)).items.length).toBe(1);
        await expect(itemsPage.actionsFabButton).toBeVisible();
    });

    test('adding a duplicate name leaves a single item once the server rejects it', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await itemsPage.goto(LIST_TITLE);
        await expect(itemsPage.itemRow('Milk')).toBeVisible();

        await itemsPage.addItem('Milk');

        await expect(authenticatedPage.getByText('Milk', { exact: true })).toHaveCount(1);
        expect((await apiGetList(LIST_TITLE)).items).toHaveLength(1);
    });
});

test.describe('Selection', () => {
    test('checking an item persists across reload and unchecking reverses it', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await itemsPage.goto(LIST_TITLE);

        await itemsPage.itemRow('Milk').click();
        await expect.poll(async () => (await apiGetList(LIST_TITLE)).items[0].isSelected).toBe(true);
        await authenticatedPage.reload();
        await expect(itemsPage.clearSelectedButton).toHaveCount(0);
        await itemsPage.actionsFabButton.click();
        await expect(itemsPage.clearSelectedButton).toBeEnabled();
        await authenticatedPage.keyboard.press('Escape');

        await itemsPage.itemRow('Milk').click();
        await expect.poll(async () => (await apiGetList(LIST_TITLE)).items[0].isSelected).toBe(false);
    });
});

test.describe('Aisles', () => {
    test('an item with a stored aisle is listed under that aisle when grouped', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await apiSetItemCategory(LIST_TITLE, 'Milk', 'dairy');
        await itemsPage.goto(LIST_TITLE);

        await authenticatedPage.getByRole('button', { name: 'Group by aisle' }).click();

        await expect(authenticatedPage.getByRole('region', { name: 'Dairy' }).getByText('Milk')).toBeVisible();
    });

    test('changing the aisle in the edit drawer moves the item to another group', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await apiSetItemCategory(LIST_TITLE, 'Milk', 'dairy');
        await itemsPage.goto(LIST_TITLE);
        await authenticatedPage.getByRole('button', { name: 'Group by aisle' }).click();
        await expect(authenticatedPage.getByRole('region', { name: 'Dairy' }).getByText('Milk')).toBeVisible();

        await itemsPage.swipeRight('Milk');
        await authenticatedPage.getByRole('button', { name: 'Edit Milk' }).click();
        await authenticatedPage.getByRole('combobox', { name: 'Aisle' }).click();
        await authenticatedPage.getByRole('option', { name: 'Bakery' }).click();
        await itemsPage.saveChangesButton.click();

        await expect(authenticatedPage.getByRole('region', { name: 'Bakery' }).getByText('Milk')).toBeVisible();
        await expect(authenticatedPage.getByRole('region', { name: 'Dairy' })).toHaveCount(0);
        await expect.poll(async () => (await apiGetList(LIST_TITLE)).items[0].category).toBe('bakery');
    });
});

test.describe('Item images', () => {
    test('shows the fallback icon when the item image cannot be loaded', async ({ authenticatedPage, itemsPage }) => {
        await authenticatedPage.route(/\/api\/image\//, (route) =>
            route.fulfill({ status: 502, json: { error: 'Image generation failed' } })
        );
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await itemsPage.goto(LIST_TITLE);

        await expect(itemsPage.itemRow('Milk')).toBeVisible();
        await expect(authenticatedPage.locator('svg.lucide-image-off')).toBeVisible();
    });

    test('shows the generated image when the endpoint returns one', async ({ authenticatedPage, itemsPage }) => {
        const png = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        );

        await authenticatedPage.route(/\/api\/image\//, (route) =>
            route.fulfill({ status: 200, contentType: 'image/png', body: png })
        );
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await itemsPage.goto(LIST_TITLE);

        await expect(authenticatedPage.getByRole('img', { name: 'Milk' })).toBeVisible();
        await expect(authenticatedPage.locator('svg.lucide-image-off')).toHaveCount(0);
    });
});

test.describe('Server errors on item writes', () => {
    test('a server rejection (4xx) rolls the optimistic item back', async ({ authenticatedPage, itemsPage }) => {
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await authenticatedPage.route(/\/api\/lists\/[^/]+\/items$/, (route) =>
            route.request().method() === 'PUT'
                ? route.fulfill({ status: 400, json: { error: 'Bad item' } })
                : route.continue()
        );

        await itemsPage.addItem('Rejected');

        await expect(itemsPage.itemRow('Rejected')).toHaveCount(0);
        expect((await apiGetList(LIST_TITLE)).items).toHaveLength(0);
    });

    test('a server failure (5xx) keeps the item and marks it as waiting to sync', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await authenticatedPage.route(/\/api\/lists\/[^/]+\/items$/, (route) =>
            route.request().method() === 'PUT'
                ? route.fulfill({ status: 500, json: { error: 'boom' } })
                : route.continue()
        );

        await itemsPage.addItem('Retry me');

        await expect(itemsPage.itemRow('Retry me')).toBeVisible();
        await expect(authenticatedPage.getByRole('img', { name: 'Waiting to sync' })).toBeVisible();
        expect((await apiGetList(LIST_TITLE)).items).toHaveLength(0);
    });

    test('a failed delete restores the item', async ({ authenticatedPage, itemsPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await itemsPage.goto(LIST_TITLE);
        await expect(itemsPage.itemRow('Milk')).toBeVisible();
        await authenticatedPage.route(/\/api\/lists\/[^/]+\/items\/[^/]+$/, (route) =>
            route.request().method() === 'DELETE'
                ? route.fulfill({ status: 404, json: { error: 'gone' } })
                : route.continue()
        );

        await itemsPage.swipeLeft('Milk');
        await authenticatedPage.getByRole('button', { name: 'Delete Milk' }).click();

        await expect(itemsPage.itemRow('Milk')).toBeVisible();
    });
});

test.describe('Refresh', () => {
    test('reloading the list shows changes made elsewhere', async ({ authenticatedPage, itemsPage }) => {
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await expect(itemsPage.itemRow('Late arrival')).toHaveCount(0);

        await apiAddItem(LIST_TITLE, 'Late arrival');
        await authenticatedPage.reload();

        await expect(itemsPage.itemRow('Late arrival')).toBeVisible();
    });
});
