import { expect, test } from '../fixtures';

const PRIVACY_URL = 'https://tandra.uk/privacy';

test.describe('Privacy notice link', () => {
    for (const path of ['/login', '/register']) {
        test(`@smoke ${path} links to the privacy notice in a new tab`, async ({ page }) => {
            await page.goto(path);
            const link = page.getByRole('link', { name: 'Privacy' });
            await expect(link).toHaveAttribute('href', PRIVACY_URL);
            await expect(link).toHaveAttribute('target', '_blank');
            await expect(link).toHaveAttribute('rel', 'noopener');
        });
    }

    // Not @smoke: it would leave a guest session behind on a live run.
    test('a guest sees the privacy link in Settings', async ({ page }) => {
        await page.goto('/try');
        await page.waitForURL((url) => url.pathname === '/');
        await page.goto('/settings');
        await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', PRIVACY_URL);
    });

    test('the what’s-new panel links to the privacy notice', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: /what's new/i }).click();
        await expect(authenticatedPage.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', PRIVACY_URL);
    });
});
