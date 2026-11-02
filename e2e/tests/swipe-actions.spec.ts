import { devices } from '@playwright/test';

import { apiAddItem, apiCreateList } from '../api-helpers';
import { expect, test } from '../fixtures';

// Guards against "edit/cancel requires 2 presses" on swiped-open shopping list
// items, under mobile/touch emulation (Chromium, iPhone viewport). A single tap
// on a revealed action button must act on the first press — if it only closes the
// swipe, these fail.
test.use({ ...devices['iPhone 13'], browserName: 'chromium' });

const LIST_TITLE = 'ReproList';

const swipe = async (page: import('@playwright/test').Page, label: string, dx: number) => {
    const box = await page.getByText(label).boundingBox();

    if (!box) throw new Error(`no bounding box for "${label}"`);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(450); // spring settle
};

test.describe('edit/cancel single-press', () => {
    test('one tap on the revealed Edit button opens the drawer', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Butter');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Butter')).toBeVisible();

        await swipe(authenticatedPage, 'Butter', 90);

        const editButton = authenticatedPage.locator('button[class*="bg-blue"]').first();
        await expect(editButton).toBeVisible();
        await editButton.click();

        await expect(authenticatedPage.getByText('Edit Item', { exact: true })).toBeVisible({ timeout: 2000 });
    });

    test('one tap on the revealed Delete button removes the item', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Cheese');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Cheese')).toBeVisible();

        await swipe(authenticatedPage, 'Cheese', -90);

        const deleteButton = authenticatedPage.locator('button[class*="bg-destructive"]').first();
        await expect(deleteButton).toBeVisible();
        await deleteButton.click();

        await expect(authenticatedPage.getByText('Cheese', { exact: true })).toBeHidden({ timeout: 3000 });
    });

    test('one tap on the drawer Cancel button closes it', async ({ authenticatedPage }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Bread');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Bread')).toBeVisible();

        await swipe(authenticatedPage, 'Bread', 90);
        await authenticatedPage.locator('button[class*="bg-blue"]').first().click();
        await expect(authenticatedPage.getByText('Edit Item', { exact: true })).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();
        await expect(authenticatedPage.getByText('Edit Item', { exact: true })).toBeHidden({ timeout: 2000 });
    });
});
