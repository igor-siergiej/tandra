import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { apiCreateList } from '../api-helpers';
import { expect, test } from '../fixtures';
import { mockAnalytics } from '../mocks/analytics';

const LIST_TITLE = 'Groceries';
const TRACKER = readFileSync(join(__dirname, '..', 'mocks', 'data', 'umami-tracker.js'), 'utf8');

// The vendored tracker (v3.4.0) predates `startSessionReplay`; give it one that records the call, appended after
// the tracker has installed `window.umami`, and count what `/pulse/recorder.js` is asked for.
const watchReplay = async (page: Page): Promise<{ recorderRequests: () => number }> => {
    let recorder = 0;
    await page.route('**/pulse/p.js', (route) =>
        route.fulfill({
            contentType: 'application/javascript',
            body: `${TRACKER}\nwindow.umami.startSessionReplay = () => { localStorage.setItem('e2e.replayStarted', 'true'); };`,
        })
    );
    await page.route('**/pulse/recorder.js', (route) => {
        recorder += 1;

        return route.fulfill({ contentType: 'application/javascript', body: '' });
    });

    return { recorderRequests: () => recorder };
};

const usageToggle = (page: Page) => page.getByLabel(/Usage statistics/i);
const recordingsToggle = (page: Page) => page.getByLabel(/Help improve Tandra with session recordings/i);
const replayStarted = (page: Page) => page.evaluate(() => localStorage.getItem('e2e.replayStarted') === 'true');

test.describe('Analytics consent in Settings', () => {
    test.use({ trackAnalytics: true });

    test('defaults: Usage statistics ON, session recordings OFF, and both survive a refresh', async ({
        authenticatedPage: page,
    }) => {
        await mockAnalytics(page);
        await page.goto('/settings');
        await expect(usageToggle(page)).toBeChecked();
        await expect(recordingsToggle(page)).not.toBeChecked();

        await recordingsToggle(page).click();
        await usageToggle(page).click();
        await page.reload();

        await expect(usageToggle(page)).not.toBeChecked();
        await expect(recordingsToggle(page)).toBeChecked();
        expect(await page.evaluate(() => localStorage.getItem('umami.disabled'))).toBe('true');
    });

    test('Usage statistics OFF: a click sends no analytics request', async ({ authenticatedPage: page }) => {
        const hits = await mockAnalytics(page);
        await apiCreateList(LIST_TITLE);
        await page.goto('/settings');
        await expect.poll(() => hits.length).toBeGreaterThan(0);

        await usageToggle(page).click();
        await page.goto(`/list/${LIST_TITLE}`);
        await page.locator('button[class*="border-primary"]').first().click();
        await page.getByPlaceholder('Enter item name...').fill('Eggs');
        await page.getByRole('button', { name: 'Add Item' }).click();
        await expect(page.getByText('Eggs')).toBeVisible();

        const seen = hits.length;
        await page.waitForTimeout(1000);
        expect(hits.length).toBe(seen);
        expect(hits.filter((h) => h.payload.name === 'item_added')).toEqual([]);
    });

    test('Usage statistics ON (the default): the same click is recorded', async ({ authenticatedPage: page }) => {
        const hits = await mockAnalytics(page);
        await apiCreateList(LIST_TITLE);
        await page.goto('/settings');
        await expect(usageToggle(page)).toBeChecked();

        await page.goto(`/list/${LIST_TITLE}`);
        await page.locator('button[class*="border-primary"]').first().click();
        await page.getByPlaceholder('Enter item name...').fill('Eggs');
        await page.getByRole('button', { name: 'Add Item' }).click();

        await expect.poll(() => hits.some((h) => h.payload.name === 'item_added')).toBe(true);
    });

    test('session recordings ON: the replay script loads and session replay starts', async ({
        authenticatedPage: page,
    }) => {
        await mockAnalytics(page);
        const { recorderRequests } = await watchReplay(page);
        await page.goto('/settings');
        await expect(recordingsToggle(page)).not.toBeChecked();
        expect(await replayStarted(page)).toBe(false);

        await recordingsToggle(page).click();

        await expect.poll(() => replayStarted(page)).toBe(true);
        expect(recorderRequests()).toBeGreaterThan(0);
    });

    test('the consent prompt shows once, can be dismissed, and stays gone after a refresh', async ({
        authenticatedPage: page,
    }) => {
        await mockAnalytics(page);
        await page.goto('/');
        const prompt = page.getByText(/session recordings?/i).first();
        await expect(prompt).toBeVisible();

        await page
            .getByRole('button', { name: /dismiss|no thanks|not now|maybe later|decline|close|skip/i })
            .first()
            .click();
        await expect(prompt).toBeHidden();

        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/session recordings?/i)).toHaveCount(0);
        // Dismissing is not consent: Settings still shows recordings OFF.
        await page.goto('/settings');
        await expect(recordingsToggle(page)).not.toBeChecked();
    });
});
