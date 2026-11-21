import { expect, test } from '../fixtures';
import { mockAnalytics } from '../mocks/analytics';

test.describe('Restoring usage statistics', () => {
    test.use({ trackAnalytics: true });

    test('enabling usage after an opted-out startup restores page views and heatmaps without recordings', async ({
        authenticatedPage: page,
    }) => {
        const hits = await mockAnalytics(page);
        let recorderRequests = 0;
        await page.route('**/pulse/recorder.js', (route) => {
            recorderRequests += 1;

            return route.fulfill({ contentType: 'application/javascript', body: '' });
        });
        await page.goto('/settings');
        await page.getByLabel('Usage statistics', { exact: true }).uncheck();
        await page.reload();
        await expect(page.getByLabel('Usage statistics', { exact: true })).not.toBeChecked();
        const before = hits.length;
        const recordersBefore = recorderRequests;

        await page.getByLabel('Usage statistics', { exact: true }).check();
        await expect
            .poll(() =>
                hits.slice(before).some((hit) => !hit.payload.name && new URL(hit.payload.url).pathname === '/settings')
            )
            .toBe(true);
        await expect.poll(() => recorderRequests).toBe(recordersBefore + 1);
        await expect(page.getByLabel('Help improve Tandra with session recordings')).not.toBeChecked();
        // SPA navigation exercises the tracker's history hooks, not a new script/page load.
        await page.evaluate(() => window.history.pushState({}, '', '/calendar'));
        await expect
            .poll(() =>
                hits.slice(before).some((hit) => !hit.payload.name && new URL(hit.payload.url).pathname === '/calendar')
            )
            .toBe(true);
    });

    test('an opt-in that cannot clear the SDK opt-out stays off until a successful retry', async ({
        authenticatedPage: page,
    }) => {
        const hits = await mockAnalytics(page);
        await page.goto('/settings');
        const usage = page.getByLabel('Usage statistics', { exact: true });
        await usage.uncheck();
        await page.reload();
        await expect(usage).not.toBeChecked();
        await page.evaluate(() => {
            Storage.prototype.removeItem = () => {
                throw new DOMException('Storage unavailable', 'SecurityError');
            };
        });

        const before = hits.length;
        await usage.click();
        await expect(usage).not.toBeChecked();
        await expect(page.getByRole('alert')).toContainText('Usage statistics stays off');
        expect(await page.evaluate(() => localStorage.getItem('umami.disabled'))).toBe('true');
        await page.evaluate(() => window.history.pushState({}, '', '/calendar'));
        await page.waitForTimeout(400);
        expect(hits).toHaveLength(before);

        // A fresh page restores native storage methods and preserves the saved opt-out.
        await page.goto('/settings');
        await usage.check();
        await expect.poll(() => hits.slice(before).some((hit) => !hit.payload.name)).toBe(true);
        await page.evaluate(() => window.history.pushState({}, '', '/recipes'));
        await expect
            .poll(() => hits.slice(before).some((hit) => new URL(hit.payload.url).pathname === '/recipes'))
            .toBe(true);
    });

    test('opting out during a tracker download does not prevent automatic tracking on the next opt-in', async ({
        authenticatedPage: page,
    }) => {
        const hits = await mockAnalytics(page);
        let releaseConfig!: () => void;

        const configGate = new Promise<void>((resolve) => {
            releaseConfig = resolve;
        });

        await page.route('**/config.json', async (route) => {
            await configGate;
            await route.fallback();
        });
        let releaseTracker!: () => void;

        const trackerGate = new Promise<void>((resolve) => {
            releaseTracker = resolve;
        });

        await page.route('**/pulse/p.js', async (route) => {
            await trackerGate;
            await route.fallback();
        });
        // Config is fetched, not a document subresource: finish document loading before injecting the SDK.
        await page.goto('/settings');
        expect(await page.evaluate(() => document.readyState)).toBe('complete');
        releaseConfig();
        const trackerRequest = page.waitForRequest('**/pulse/p.js');
        const usage = page.getByLabel('Usage statistics', { exact: true });
        await expect(usage).toBeVisible();
        await trackerRequest;
        await usage.uncheck();
        const downloaded = page.waitForResponse('**/pulse/p.js');
        releaseTracker();
        await downloaded;
        await expect.poll(() => page.evaluate(() => document.querySelector('script[src$="/p.js"]'))).toBeNull();
        expect(hits).toHaveLength(0);

        await usage.check();
        await expect
            .poll(() => hits.some((hit) => !hit.payload.name && new URL(hit.payload.url).pathname === '/settings'))
            .toBe(true);
        await page.evaluate(() => window.history.pushState({}, '', '/calendar'));
        await expect
            .poll(() => hits.some((hit) => !hit.payload.name && new URL(hit.payload.url).pathname === '/calendar'))
            .toBe(true);
    });
});
