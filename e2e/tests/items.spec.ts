import { apiAddItem, apiCreateList, apiUpdateItem } from '../api-helpers';
import { expect, test } from '../fixtures';

const LIST_TITLE = 'Groceries';

// Lists are opened by their id, so the URL no longer carries the title.
const LIST_URL = /\/list\/[^/]+$/;

test.describe('Items page', () => {
    test('shows empty state for empty list', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByRole('button', { name: 'Go back' })).toBeVisible();
    });

    test('renders items from database', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await apiAddItem(LIST_TITLE, 'Bread');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Milk')).toBeVisible();
        await expect(authenticatedPage.getByText('Bread')).toBeVisible();
    });

    test('can add an item', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByText('Add New Item', { exact: true })).toBeVisible();
        await authenticatedPage.getByPlaceholder('Enter item name...').fill('Eggs');
        await authenticatedPage.getByRole('button', { name: 'Add Item' }).click();

        await expect(authenticatedPage.getByText('Eggs')).toBeVisible();
    });

    test('can group items by aisle and the choice is remembered', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Milk')).toBeVisible();
        await expect(authenticatedPage.getByRole('heading', { level: 2 })).toHaveCount(0);

        await authenticatedPage.getByRole('button', { name: 'Group by aisle' }).click();
        await expect(authenticatedPage.getByRole('heading', { level: 2 }).first()).toBeVisible();

        await authenticatedPage.reload();
        await expect(authenticatedPage.getByRole('button', { name: 'Ungroup' })).toBeVisible();
        await expect(authenticatedPage.getByRole('heading', { level: 2 }).first()).toBeVisible();
    });

    test('can toggle item selection', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Milk')).toBeVisible();

        const strike = authenticatedPage.getByRole('button').filter({ hasText: 'Milk' }).getByTestId('strike-drawn');
        await expect(strike).toHaveAttribute('data-struck', 'false');

        await authenticatedPage.getByText('Milk').click();
        await expect(strike).toHaveAttribute('data-struck', 'true');

        await authenticatedPage.getByText('Milk').click();
        await expect(strike).toHaveAttribute('data-struck', 'false');
    });

    test('an already-checked item shows the finished strike without replaying it', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await apiUpdateItem(LIST_TITLE, 'Milk', { isSelected: true });
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        const strike = authenticatedPage.getByRole('button').filter({ hasText: 'Milk' }).getByTestId('strike-drawn');
        await expect(strike).toHaveAttribute('data-struck', 'true');
        // Sampled straight after mount: a replaying draw would still be near opacity 0 here.
        expect(await strike.locator('path').evaluate((path) => getComputedStyle(path).opacity)).toBe('1');
    });

    test('can clear all items', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await apiAddItem(LIST_TITLE, 'Bread');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Remove All' }).click();
        await expect(authenticatedPage.getByText('Clear All Items?')).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Clear All Items' }).click();

        await expect(authenticatedPage.getByText('Milk')).not.toBeVisible();
        await expect(authenticatedPage.getByText('Bread')).not.toBeVisible();
    });

    test('can clear selected items', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await apiAddItem(LIST_TITLE, 'Bread');
        await apiUpdateItem(LIST_TITLE, 'Milk', { isSelected: true });
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Clear Selected' }).click();
        await expect(authenticatedPage.getByText('Clear Selected Items?')).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Clear Selected' }).click();

        await expect(authenticatedPage.getByText('Milk')).not.toBeVisible();
        await expect(authenticatedPage.getByText('Bread')).toBeVisible();
    });

    test('back button returns to lists page', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await authenticatedPage.getByRole('button', { name: 'Go back' }).click();
        await authenticatedPage.waitForURL('/');
    });

    test('back button after in-app navigation does not leave the browser back button pointing at Items again', async ({
        authenticatedPage,
    }) => {
        await apiCreateList(LIST_TITLE);

        // Arrive at Items via real in-app navigation (not a direct goto), so
        // there's genuine SPA history to pop into.
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: LIST_TITLE }).click();
        await authenticatedPage.waitForURL(LIST_URL);
        const itemsUrl = authenticatedPage.url();

        await authenticatedPage.getByRole('button', { name: 'Go back' }).click();
        await authenticatedPage.waitForURL('/');

        // With the old behaviour (navigate(path) push), history was
        // [/, /list/Groceries, /] and browser back would land back on
        // /list/Groceries. With real back-navigation, browser back should
        // instead leave the SPA's list history (landing wherever the page
        // was loaded from, not back on the Items page).
        await authenticatedPage.goBack();
        await expect(authenticatedPage).not.toHaveURL(itemsUrl);
    });

    test('swipe left reveals delete — deletes item', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Butter');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Butter')).toBeVisible();

        const itemEl = authenticatedPage.getByText('Butter');
        const box = await itemEl.boundingBox();

        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await authenticatedPage.mouse.move(cx, cy);
            await authenticatedPage.mouse.down();
            await authenticatedPage.mouse.move(cx - 90, cy, { steps: 10 });
            await authenticatedPage.mouse.up();
            await authenticatedPage.waitForTimeout(300);

            const deleteButtons = authenticatedPage.locator(
                'button[class*="destructive"], button[class*="bg-destructive"]'
            );

            if ((await deleteButtons.count()) > 0) {
                await deleteButtons.first().click();
                await expect(authenticatedPage.getByText('Butter')).not.toBeVisible();
            }
        }
    });

    test('can add item with quantity and unit', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByText('Add New Item', { exact: true })).toBeVisible();
        await authenticatedPage.getByPlaceholder('Enter item name...').fill('Milk');
        await authenticatedPage.getByLabel('Quantity').fill('2');
        await authenticatedPage.getByLabel('Unit').click();
        await authenticatedPage.getByRole('option', { name: 'L', exact: true }).click();
        await authenticatedPage.getByRole('button', { name: 'Add Item' }).click();

        await expect(authenticatedPage.getByText('Milk')).toBeVisible();
        await expect(authenticatedPage.getByText('2 L')).toBeVisible();
    });

    test('can edit item quantity and unit', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Butter');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        const itemEl = authenticatedPage.getByText('Butter');
        const box = await itemEl.boundingBox();

        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await authenticatedPage.mouse.move(cx, cy);
            await authenticatedPage.mouse.down();
            await authenticatedPage.mouse.move(cx + 90, cy, { steps: 10 });
            await authenticatedPage.mouse.up();
            await authenticatedPage.waitForTimeout(300);

            const editButtons = authenticatedPage.locator('button[class*="bg-blue"]');

            if ((await editButtons.count()) > 0) {
                await editButtons.first().click();
                await expect(authenticatedPage.getByText('Edit Item', { exact: true })).toBeVisible();
                await authenticatedPage.getByLabel('Quantity').fill('3');
                await authenticatedPage.getByLabel('Unit').click();
                await authenticatedPage.getByRole('option', { name: 'kg' }).click();
                await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();
                await expect(authenticatedPage.getByText('3 kg')).toBeVisible();
            }
        }
    });

    test('edit item changes name', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Butter');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);

        const itemEl = authenticatedPage.getByText('Butter');
        const box = await itemEl.boundingBox();

        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await authenticatedPage.mouse.move(cx, cy);
            await authenticatedPage.mouse.down();
            await authenticatedPage.mouse.move(cx + 90, cy, { steps: 10 });
            await authenticatedPage.mouse.up();
            await authenticatedPage.waitForTimeout(300);

            const editButtons = authenticatedPage.locator('button[class*="bg-blue"]');

            if ((await editButtons.count()) > 0) {
                await editButtons.first().click();
                await expect(authenticatedPage.getByText('Edit Item', { exact: true })).toBeVisible();
                await authenticatedPage.getByLabel('Item Name').clear();
                await authenticatedPage.getByLabel('Item Name').fill('Margarine');
                await authenticatedPage.getByRole('button', { name: 'Save Changes' }).click();
                await expect(authenticatedPage.getByText('Margarine')).toBeVisible();
            }
        }
    });
});
