import type { Browser } from '@playwright/test';

import { apiAddItem, apiCreateList, apiDeleteItem, apiUpdateItem } from '../api-helpers';
import { openPageAs } from '../auth';
import { seedFriendship } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';

const LIST_TITLE = 'Shared Realtime';

// Acceptance bar from the card is ~2s; leave headroom for the CI runner, not for polling.
const SYNC_TIMEOUT = 3000;

// A list owned by the default test user and shared with a friend, who gets their own browser context.
const shareListWithSecondUser = async (browser: Browser) => {
    await seedFriendship(MOCK_USER, MOCK_USER_2);
    await apiCreateList(LIST_TITLE, 'shopping', [MOCK_USER_2.id]);

    const page = await openPageAs(browser, MOCK_USER_2);

    return { context: page.context(), page };
};

test.describe('Real-time shared lists', () => {
    test('changes and presence reach another member without a refresh', async ({ authenticatedPage, browser }) => {
        test.setTimeout(30_000);
        const { context, page: pageB } = await shareListWithSecondUser(browser);

        try {
            await apiAddItem(LIST_TITLE, 'Bread');
            await authenticatedPage.goto(`/list/${LIST_TITLE}`);
            await expect(authenticatedPage.getByText('Bread')).toBeVisible();
            await pageB.goto(`/list/${LIST_TITLE}`);
            await expect(pageB.getByText('Bread')).toBeVisible();

            // Presence: each sees the other, never themselves.
            await expect(authenticatedPage.getByTestId('list-viewers')).toHaveText(/otheruser is also viewing/);
            await expect(pageB.getByTestId('list-viewers')).toHaveText(/testuser is also viewing/);

            // Add, toggle, delete by A show up on B's open screen with no reload.
            await apiAddItem(LIST_TITLE, 'Milk');
            await expect(pageB.getByText('Milk')).toBeVisible({ timeout: SYNC_TIMEOUT });
            await apiUpdateItem(LIST_TITLE, 'Milk', { isSelected: true });
            await expect(pageB.locator('div[class*="bg-primary/10"]', { hasText: 'Milk' })).toBeVisible({
                timeout: SYNC_TIMEOUT,
            });
            await apiDeleteItem(LIST_TITLE, 'Milk');
            await expect(pageB.getByText('Milk')).toHaveCount(0, { timeout: SYNC_TIMEOUT });

            // Presence clears when B leaves.
            await pageB.close();
            await expect(authenticatedPage.getByTestId('list-viewers')).toHaveCount(0, { timeout: SYNC_TIMEOUT });
        } finally {
            await context.close();
        }
    });

    test('a member whose connection dropped catches up on reconnect', async ({ authenticatedPage: _a, browser }) => {
        test.setTimeout(30_000);
        const { context, page: pageB } = await shareListWithSecondUser(browser);

        try {
            await pageB.goto(`/list/${LIST_TITLE}`);
            await expect(pageB.getByRole('button', { name: 'Menu' })).toBeVisible();

            await context.setOffline(true);
            await apiAddItem(LIST_TITLE, 'While away');
            await context.setOffline(false);

            await expect(pageB.getByText('While away')).toBeVisible({ timeout: 10_000 });
        } finally {
            await context.close();
        }
    });
});
