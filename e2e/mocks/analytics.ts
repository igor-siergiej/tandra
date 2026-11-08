import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

export const ANALYTICS_WEBSITE_ID = 'e2e-website';

const TRACKER = readFileSync(join(__dirname, 'data', 'umami-tracker.js'), 'utf8');

/** One request the Umami tracker sent to its collect endpoint. */
export interface CollectedHit {
    type: string;
    payload: {
        website: string;
        hostname: string;
        url: string;
        name?: string;
        data?: Record<string, string | number | boolean>;
    };
}

/**
 * Enables analytics the way production does (same-origin `/pulse`), serves the real Umami
 * tracker for `/pulse/p.js`, and records what it posts to `/pulse/p`. The heatmap recorder
 * (`/pulse/recorder.js`, 190 KB of rrweb) is served empty; it is not under test here.
 * No request reaches Umami. Call before the first navigation.
 */
export const mockAnalytics = async (page: Page): Promise<Array<CollectedHit>> => {
    const hits: Array<CollectedHit> = [];
    await page.route('**/config.json', async (route) => {
        const host = new URL('/pulse', route.request().url()).toString();
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ analytics: { host, websiteId: ANALYTICS_WEBSITE_ID, enabled: true } }),
        });
    });
    await page.route('**/pulse/p.js', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: TRACKER })
    );
    await page.route('**/pulse/recorder.js', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' })
    );
    await page.route('**/pulse/p', async (route) => {
        const hit: CollectedHit = route.request().postDataJSON();
        hits.push(hit);
        await route.fulfill({ contentType: 'application/json', body: '{}' });
    });

    return hits;
};
