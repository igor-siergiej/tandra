import type { Browser, Page } from '@playwright/test';

import {
    apiAddItem,
    apiCreateList,
    apiCreateListAsOtherUser,
    apiGetList,
    apiRemoveListMemberAsOtherUser,
} from '../api-helpers';
import { openPageAs } from '../auth';
import { expireFriendCodes, seedFriendship } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';

test.describe.configure({ timeout: 30_000 });

// A second signed-in user in their own browser context.
const asSecondUser = (browser: Browser): Promise<Page> => openPageAs(browser, MOCK_USER_2);

const generateCode = async (page: Page): Promise<string> => {
    await page.goto('/friends');
    await page.getByRole('button', { name: 'Add friend' }).click();
    await page.getByRole('button', { name: 'Create invite' }).click();
    await page.getByRole('button', { name: 'Generate invite code' }).click();
    const code = page.locator('p.font-mono');
    await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
    return code.innerText();
};

const redeemCode = async (page: Page, code: string) => {
    await page.goto('/friends');
    await page.getByRole('button', { name: 'Add friend' }).click();
    await page.getByRole('button', { name: 'Enter a code' }).click();
    await page.locator('input[data-input-otp]').fill(code);
    await page.getByRole('button', { name: 'Add friend' }).click();
};

test.describe('Friend invites between two users', () => {
    test('one user generates a code, the other redeems it, and both see each other', async ({
        authenticatedPage,
        browser,
    }) => {
        const pageB = await asSecondUser(browser);
        try {
            const code = await generateCode(authenticatedPage);

            await redeemCode(pageB, code);
            await expect(pageB.getByText(MOCK_USER.username)).toBeVisible();

            await authenticatedPage.goto('/friends');
            await expect(authenticatedPage.getByText(MOCK_USER_2.username)).toBeVisible();
        } finally {
            await pageB.context().close();
        }
    });

    test('a code works once: a second attempt is refused', async ({ authenticatedPage, browser }) => {
        const pageB = await asSecondUser(browser);
        try {
            const code = await generateCode(authenticatedPage);
            await redeemCode(pageB, code);
            await expect(pageB.getByText(MOCK_USER.username)).toBeVisible();

            await redeemCode(pageB, code);

            await expect(pageB.getByText(/already been used|already friends/)).toBeVisible();
        } finally {
            await pageB.context().close();
        }
    });

    test('an expired code is refused', async ({ authenticatedPage, browser }) => {
        const pageB = await asSecondUser(browser);
        try {
            const code = await generateCode(authenticatedPage);
            await expireFriendCodes();

            await redeemCode(pageB, code);

            await expect(pageB.getByText('This code has expired')).toBeVisible();
            await pageB.goto('/friends');
            await expect(pageB.getByText('No friends yet')).toBeVisible();
        } finally {
            await pageB.context().close();
        }
    });

    test('redeeming a code from someone you are already friends with is refused', async ({
        authenticatedPage,
        browser,
    }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        const pageB = await asSecondUser(browser);
        try {
            const code = await generateCode(authenticatedPage);

            await redeemCode(pageB, code);

            await expect(pageB.getByText('You are already friends')).toBeVisible();
        } finally {
            await pageB.context().close();
        }
    });

    test('the Add friend button stays disabled until the whole code is entered', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/friends');
        await authenticatedPage.getByRole('button', { name: 'Add friend' }).click();
        await authenticatedPage.getByRole('button', { name: 'Enter a code' }).click();

        await authenticatedPage.locator('input[data-input-otp]').fill('ABC');
        await expect(authenticatedPage.getByRole('button', { name: 'Add friend' })).toBeDisabled();

        await authenticatedPage.locator('input[data-input-otp]').fill('ABCDEF');
        await expect(authenticatedPage.getByRole('button', { name: 'Add friend' })).toBeEnabled();
    });
});

test.describe('Removing a friend', () => {
    test('stops offering them when sharing a new list', async ({ authenticatedPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await authenticatedPage.goto('/');
        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByText(MOCK_USER_2.username)).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await authenticatedPage.goto('/friends');
        await authenticatedPage.getByText(MOCK_USER_2.username).click();
        await authenticatedPage.getByRole('button', { name: 'Remove friend' }).click();
        await authenticatedPage.getByRole('alertdialog').getByRole('button', { name: 'Remove friend' }).click();
        await expect(authenticatedPage.getByText('No friends yet')).toBeVisible();

        await authenticatedPage.goto('/');
        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByLabel('List Name')).toBeVisible();
        await expect(authenticatedPage.getByText(MOCK_USER_2.username)).toHaveCount(0);
    });

    test('removes them from lists I shared with them', async ({ authenticatedPage, browser }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await apiCreateList('Shared Shop', 'shopping', [MOCK_USER_2.id]);
        const pageB = await asSecondUser(browser);
        try {
            await pageB.goto('/');
            await expect(pageB.getByRole('button', { name: 'Shared Shop' })).toBeVisible();

            await authenticatedPage.goto('/friends');
            await authenticatedPage.getByText(MOCK_USER_2.username).click();
            await authenticatedPage.getByRole('button', { name: 'Remove friend' }).click();
            await authenticatedPage.getByRole('alertdialog').getByRole('button', { name: 'Remove friend' }).click();
            await expect(authenticatedPage.getByText('No friends yet')).toBeVisible();

            await pageB.reload();
            await expect(pageB.getByText('No lists yet')).toBeVisible();
            await expect(pageB.getByRole('button', { name: 'Shared Shop' })).toHaveCount(0);
        } finally {
            await pageB.context().close();
        }
    });
});

test.describe('A list shared with me', () => {
    const shareWithMe = async (title: string) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        return apiCreateListAsOtherUser(title, [MOCK_USER.id]);
    };

    test('appears in my lists without rename or delete controls', async ({ listsPage }) => {
        await apiCreateList('Mine');
        await shareWithMe('Theirs');
        await listsPage.goto();

        await expect(listsPage.listCard('Mine')).toBeVisible();
        await expect(listsPage.listCard('Theirs')).toBeVisible();
        const mineRow = listsPage.listCard('Mine').locator('../../..');
        const theirsRow = listsPage.listCard('Theirs').locator('../../..');
        await expect(mineRow.getByRole('button')).toHaveCount(3);
        await expect(theirsRow.getByRole('button')).toHaveCount(1);
    });

    test('I can add, tick off and remove items on it', async ({ authenticatedPage, itemsPage }) => {
        const theirs = await shareWithMe('Theirs');
        await apiAddItem('Theirs', 'Milk');
        await itemsPage.goto(theirs.id);
        await expect(itemsPage.itemRow('Milk')).toBeVisible();

        await itemsPage.addItem('Bread');
        await expect(itemsPage.itemRow('Bread')).toBeVisible();
        await itemsPage.itemRow('Milk').click();
        await expect
            .poll(async () => (await apiGetList('Theirs')).items.find((i) => i.name === 'Milk')?.isSelected)
            .toBe(true);

        await itemsPage.swipeLeft('Bread');
        await authenticatedPage.getByRole('button', { name: 'Delete Bread' }).click();
        await expect.poll(async () => (await apiGetList('Theirs')).items.map((i) => i.name)).toEqual(['Milk']);
    });

    test('does not offer Manage Users to a non-owner', async ({ authenticatedPage, itemsPage }) => {
        const theirs = await shareWithMe('Theirs');
        await itemsPage.goto(theirs.id);
        await itemsPage.actionsFabButton.click();

        await expect(authenticatedPage.getByRole('button', { name: 'Remove All' })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Manage Users' })).toHaveCount(0);
    });

    test('vanishes from my lists when the owner removes me', async ({ authenticatedPage, listsPage }) => {
        await shareWithMe('Theirs');
        await listsPage.goto();
        await expect(listsPage.listCard('Theirs')).toBeVisible();

        await apiRemoveListMemberAsOtherUser('Theirs', MOCK_USER.id);
        await authenticatedPage.reload();

        await expect(listsPage.emptyStateText).toBeVisible();
    });

    test('opening a list I have no access to shows the error state, not a blank page', async ({
        authenticatedPage,
    }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        const theirs = await apiCreateListAsOtherUser('Private', []);

        await authenticatedPage.goto(`/list/${theirs.id}`);

        await expect(authenticatedPage.getByText('Unable to load items')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: /retry/i })).toBeVisible();
    });

    test('a list that does not exist shows the error state too', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/list/no-such-list');

        await expect(authenticatedPage.getByText('Unable to load items')).toBeVisible();
    });
});
