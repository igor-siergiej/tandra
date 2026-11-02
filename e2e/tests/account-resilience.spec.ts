import type { Page } from '@playwright/test';

import { apiCreateList } from '../api-helpers';
import { expect, test } from '../fixtures';
import { installFakePush } from '../mocks/push';

test.describe.configure({ timeout: 20000 });

test.describe('Sign in failures', () => {
    test('wrong credentials show the server message and stay on the login page', async ({ page, loginPage }) => {
        await loginPage.goto();

        await loginPage.login('testuser', 'wrongpassword1');

        await expect(page.getByText('Invalid username or password')).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });

    test('an unknown user gets the same message, so usernames cannot be probed', async ({ page, loginPage }) => {
        await loginPage.goto();

        await loginPage.login('nobody', 'password123');

        await expect(page.getByText('Invalid username or password')).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });

    test('registering a taken username says so', async ({ page, registerPage }) => {
        await registerPage.goto();

        await registerPage.register('TestUser', 'password123', 'password123');

        await expect(page.getByText('That username is taken')).toBeVisible();
        await expect(page).toHaveURL(/\/register$/);
    });

    test('password rules are explained before anything is sent', async ({ page, registerPage }) => {
        let registerCalls = 0;
        page.on('request', (req) => {
            if (req.url().includes('/api/auth/sign-up')) registerCalls++;
        });
        await registerPage.goto();

        await registerPage.register('newuser', 'short', 'short');
        await expect(page.getByText(/At least 8 characters, letters and digits only/)).toBeVisible();

        await registerPage.register('newuser', 'onlyletters', 'onlyletters');
        await expect(page.getByText(/must include both letters and a number/)).toBeVisible();
        expect(registerCalls).toBe(0);
    });
});

test.describe('Session', () => {
    test('a reload keeps the user signed in', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await expect(authenticatedPage.getByRole('button', { name: 'Menu' })).toBeVisible();

        await authenticatedPage.reload();

        await expect(authenticatedPage.getByRole('button', { name: 'Menu' })).toBeVisible();
        await expect(authenticatedPage).toHaveURL('/');
    });

    test('opening a deep link while signed out goes to login, and login lands in the app', async ({
        page,
        loginPage,
    }) => {
        await page.goto('/recipes');
        await page.waitForURL(/\/login$/);

        await loginPage.login('testuser', 'password123');

        await page.waitForURL((url) => url.pathname === '/recipes');
        await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    });

    test('when the session is gone the user is sent to login', async ({ authenticatedPage }) => {
        await authenticatedPage.route('**/api/lists/user/**', (route) =>
            route.fulfill({ status: 401, json: { error: 'Unauthorized' } })
        );

        await authenticatedPage.goto('/');

        await authenticatedPage.waitForURL(/\/login$/);
    });

    test("logging out and signing in as someone else shows none of the previous user's lists", async ({
        authenticatedPage,
        loginPage,
    }) => {
        await apiCreateList('First User List');
        await authenticatedPage.goto('/');
        await expect(authenticatedPage.getByRole('button', { name: 'First User List' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();
        await authenticatedPage.getByRole('button', { name: 'Log out' }).click();
        await authenticatedPage.waitForURL(/\/login$/);

        await loginPage.login('otheruser', 'password123');
        await authenticatedPage.waitForURL('/');

        await expect(authenticatedPage.getByText('No lists yet')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'First User List' })).toHaveCount(0);
    });
});

test.describe('Menu and settings', () => {
    const openMenu = async (page: Page) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Menu' }).click();
    };

    test('Settings is reachable from the menu', async ({ authenticatedPage }) => {
        await openMenu(authenticatedPage);

        await authenticatedPage.getByRole('button', { name: 'Settings' }).click();

        await authenticatedPage.waitForURL('/settings');
        await expect(authenticatedPage.getByText('Units', { exact: true })).toBeVisible();
    });

    test('the theme can be switched and is remembered across reloads', async ({ authenticatedPage }) => {
        await openMenu(authenticatedPage);
        const root = authenticatedPage.locator('html');
        const before = (await root.getAttribute('class'))?.includes('dark') ?? false;

        await authenticatedPage.getByRole('button', { name: before ? 'Dark Mode' : 'Light Mode' }).click();
        await expect(root).toHaveClass(before ? /light/ : /dark/);

        await authenticatedPage.reload();
        await expect(root).toHaveClass(before ? /light/ : /dark/);
    });

    test('Install app is offered only once the browser says the app can be installed', async ({
        authenticatedPage,
    }) => {
        await openMenu(authenticatedPage);
        await expect(authenticatedPage.getByRole('button', { name: 'Install app' })).toHaveCount(0);
        await authenticatedPage.keyboard.press('Escape');

        await authenticatedPage.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();

        await expect(authenticatedPage.getByRole('button', { name: 'Install app' })).toBeVisible();
    });

    test('there is a way to check for updates from the menu', async ({ authenticatedPage }) => {
        await openMenu(authenticatedPage);

        await expect(
            authenticatedPage.getByRole('button', { name: /Check for updates|Update available/ })
        ).toBeVisible();
    });
});

test.describe('Push notifications toggle', () => {
    const notificationsToggle = (page: Page) => page.getByRole('button', { name: /Notifications/ }).getByRole('switch');

    test('granting permission subscribes, and the switch is on after a reload', async ({ authenticatedPage }) => {
        await installFakePush(authenticatedPage, { permission: 'default', requestResult: 'granted' });
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();

        const subscribed = authenticatedPage.waitForRequest(
            (req) => req.url().endsWith('/api/push/subscribe') && req.method() === 'POST'
        );

        await authenticatedPage.getByRole('button', { name: /Notifications/ }).click();
        await subscribed;
        await expect(notificationsToggle(authenticatedPage)).toBeChecked();
    });

    test('an existing subscription shows as on, and switching off unsubscribes', async ({ authenticatedPage }) => {
        await installFakePush(authenticatedPage, { permission: 'granted', subscribed: true });
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();
        await expect(notificationsToggle(authenticatedPage)).toBeChecked();

        const unsubscribed = authenticatedPage.waitForRequest(
            (req) => req.url().endsWith('/api/push/subscribe') && req.method() === 'DELETE'
        );

        await authenticatedPage.getByRole('button', { name: /Notifications/ }).click();

        await unsubscribed;
        await expect(notificationsToggle(authenticatedPage)).not.toBeChecked();
    });

    test('a server without push configured leaves the switch off', async ({ authenticatedPage }) => {
        await installFakePush(authenticatedPage, {
            permission: 'default',
            requestResult: 'granted',
            vapidPublicKey: null,
        });
        let subscribeCalls = 0;
        authenticatedPage.on('request', (req) => {
            if (req.url().endsWith('/api/push/subscribe') && req.method() === 'POST') subscribeCalls++;
        });
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();

        await authenticatedPage.getByRole('button', { name: /Notifications/ }).click();

        await expect(notificationsToggle(authenticatedPage)).not.toBeChecked();
        expect(subscribeCalls).toBe(0);
    });
});

test.describe('Errors and connectivity', () => {
    test('an unknown address shows an error page with a way back home', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/definitely/not/a/page');

        await expect(authenticatedPage.getByText(/something went wrong|not found|404/i).first()).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: /Go Home|Home/ })).toBeVisible();
    });

    test('going offline and back online is announced', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await expect(authenticatedPage.getByRole('button', { name: 'Menu' })).toBeVisible();

        await authenticatedPage.context().setOffline(true);
        await expect(authenticatedPage.getByText('You are offline')).toBeVisible();

        await authenticatedPage.context().setOffline(false);
        await expect(authenticatedPage.getByText('Back online')).toBeVisible();
    });

    test('a list created offline is kept and synced when the connection returns', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await expect(authenticatedPage.getByText('No lists yet')).toBeVisible();
        await authenticatedPage.context().setOffline(true);
        await expect(authenticatedPage.getByText('You are offline')).toBeVisible();

        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await authenticatedPage.getByLabel('List Name').fill('Made Offline');
        await authenticatedPage.getByRole('button', { name: 'Add List' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'Made Offline' })).toBeVisible();

        const synced = authenticatedPage.waitForResponse(
            (r) => r.url().endsWith('/api/lists') && r.request().method() === 'PUT'
        );

        await authenticatedPage.context().setOffline(false);
        await synced;

        await authenticatedPage.reload();
        await expect(authenticatedPage.getByRole('button', { name: 'Made Offline' })).toBeVisible();
    });

    test('a recipe edited offline is saved when the connection returns', async ({ authenticatedPage }) => {
        const { apiCreateRecipe, apiGetRecipes } = await import('../api-helpers');
        const recipe = await apiCreateRecipe('Offline Edit');
        await authenticatedPage.goto(`/recipes/${recipe.id}`);
        await authenticatedPage.locator('h1').last().waitFor({ timeout: 10000 });
        await authenticatedPage.context().setOffline(true);
        await expect(authenticatedPage.getByText('You are offline')).toBeVisible();

        await authenticatedPage.getByLabel('Edit recipe').click();
        await authenticatedPage.getByLabel('Recipe title').fill('Edited Offline');
        await authenticatedPage.getByRole('button', { name: 'Save', exact: true }).click();

        const synced = authenticatedPage.waitForResponse(
            (r) => /\/api\/recipes\/[^/]+$/.test(r.url()) && r.request().method() === 'PUT'
        );

        await authenticatedPage.context().setOffline(false);
        await synced;

        await expect.poll(async () => (await apiGetRecipes())[0]?.title).toBe('Edited Offline');
    });

    test('a queued change the server rejects is dropped instead of retrying forever', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await apiCreateList('Reject Me');
        await itemsPage.goto('Reject Me');
        await expect(itemsPage.actionsFabButton).toBeVisible();
        let attempts = 0;
        await authenticatedPage.route(/\/api\/lists\/[^/]+\/items$/, (route) => {
            if (route.request().method() !== 'PUT') return route.continue();
            attempts++;

            return route.fulfill({
                status: 409,
                json: { error: 'An item with that name already exists in this list' },
            });
        });

        await itemsPage.addItem('Dupe');
        await expect(itemsPage.itemRow('Dupe')).toHaveCount(0);
        await authenticatedPage.waitForTimeout(1500);

        expect(attempts).toBe(1);
        await expect(authenticatedPage.getByText(/pending/)).toHaveCount(0);
    });
});
