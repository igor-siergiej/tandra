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
});
