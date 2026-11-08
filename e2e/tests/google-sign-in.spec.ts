import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';

const serveFeatures = (page: Page, googleSignIn: boolean) =>
    page.route('**/api/features', (route) => route.fulfill({ json: { googleSignIn } }));

test.describe('Google sign-in', () => {
    for (const path of ['/login', '/register']) {
        test(`${path} offers Google when the server has it on`, async ({ page }) => {
            await serveFeatures(page, true);
            await page.goto(path);
            await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
        });

        test(`${path} hides Google when the server has it off`, async ({ page }) => {
            await serveFeatures(page, false);
            await page.goto(path);
            await expect(page.getByRole('button', { name: /^(Login|Create Account)$/ })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
        });
    }

    test('a cancelled Google sign-in is explained on the login page', async ({ page }) => {
        await serveFeatures(page, true);
        await page.goto('/login?error=access_denied');
        await expect(page.getByText('Google sign-in was cancelled.')).toBeVisible();
    });

    test('Settings shows the account and offers to link Google', async ({ authenticatedPage }) => {
        await authenticatedPage.route('**/api/features', (route) => route.fulfill({ json: { googleSignIn: true } }));
        await authenticatedPage.goto('/settings');

        await expect(authenticatedPage.getByRole('heading', { name: 'Account' })).toBeVisible();
        await expect(authenticatedPage.getByText('testuser', { exact: true })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Link Google account' })).toBeVisible();
    });
});
