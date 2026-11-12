import { devices } from '@playwright/test';

import { apiAddItem, apiCreateList } from '../api-helpers';
import { expect, test } from '../fixtures';

// Regression coverage for tandra-shopping-list-delete-double-press (reported on
// Android Chrome): the revealed Delete button's hit-test can race the card's spring
// settle animation, so a tap that lands before settle hits the still-overlapping
// card (closing the swipe) instead of the button — "needs 2 presses". Pixel 5 uses
// Chromium (same engine as real Android Chrome, unlike the iOS/WebKit gap the
// desktop-Chromium iPhone emulation in swipe-actions.spec.ts has), so this is a
// closer proxy for the reported device. Split into its own file because Playwright
// forbids overriding browserName in a nested describe block.
test.use({ ...devices['Pixel 5'], browserName: 'chromium' });

const LIST_TITLE = 'ReproList';

const swipeNoSettleWait = async (page: import('@playwright/test').Page, label: string, dx: number) => {
    const box = await page.getByText(label).boundingBox();

    if (!box) throw new Error(`no bounding box for "${label}"`);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy, { steps: 12 });
    await page.mouse.up();
};

test.describe('Android Chrome (Pixel 5) delete swipe', () => {
    test('a fast tap on the revealed Delete button, before the settle animation finishes, deletes on the first press', async ({
        authenticatedPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Milk');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Milk')).toBeVisible();

        await swipeNoSettleWait(authenticatedPage, 'Milk', -90);
        // No settle wait here on purpose — taps as soon as the button is in the DOM,
        // which is the exact race the reported bug depends on.
        await authenticatedPage.locator('button[class*="bg-destructive"]').first().click();

        await expect(authenticatedPage.getByText('Milk', { exact: true })).toBeHidden({ timeout: 3000 });
    });

    test('swiping past the old delete-commit distance does not delete on release; the revealed button still must be tapped', async ({
        authenticatedPage,
    }) => {
        await apiCreateList(LIST_TITLE);
        await apiAddItem(LIST_TITLE, 'Eggs');
        await authenticatedPage.goto(`/list/${LIST_TITLE}`);
        await expect(authenticatedPage.getByText('Eggs')).toBeVisible();

        await swipeNoSettleWait(authenticatedPage, 'Eggs', -170);

        // A far, fast swipe with no follow-up tap must never delete on its own.
        await authenticatedPage.waitForTimeout(500);
        await expect(authenticatedPage.getByText('Eggs', { exact: true })).toBeVisible();

        const deleteButton = authenticatedPage.locator('button[class*="bg-destructive"]').first();
        await expect(deleteButton).toBeVisible();
        await deleteButton.click();

        await expect(authenticatedPage.getByText('Eggs', { exact: true })).toBeHidden({ timeout: 3000 });
    });
});
