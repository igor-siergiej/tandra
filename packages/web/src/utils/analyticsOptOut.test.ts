import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type * as AnalyticsModule from './analytics';

// Settings > "Usage statistics" turns tracking off by writing `localStorage['umami.disabled'] = 'true'`.
// The module must read that key on every call, so a visitor's choice takes effect without a reload or redeploy.

vi.mock('./config', () => ({
    getConfig: () => ({ analytics: { host: 'https://app.tandra.uk/pulse', websiteId: 'site-1' } }),
}));

// Dynamic import on purpose: the injected flags are module state, so each test needs a fresh module instance.
/** A fresh module (the injected flags are module state) whose tracker script has "loaded" with a fake `window.umami`. */
const loadedModule = async (): Promise<{ analytics: typeof AnalyticsModule; sent: Array<[string, unknown]> }> => {
    vi.resetModules();
    const analytics = await import('./analytics');
    const sent: Array<[string, unknown]> = [];
    analytics.loadTracker();
    window.umami = { track: (event, data) => sent.push([event, data]), identify: vi.fn() };
    document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));

    return { analytics, sent };
};

describe('analytics respects umami.disabled', () => {
    beforeEach(() => {
        delete window.umami;
        document.head.innerHTML = '';
        localStorage.clear();
    });

    afterEach(() => {
        delete window.umami;
        document.head.innerHTML = '';
        localStorage.clear();
    });

    it('track() sends nothing while umami.disabled is "true"', async () => {
        const { analytics, sent } = await loadedModule();
        localStorage.setItem('umami.disabled', 'true');

        analytics.track('item_added', { source: 'typed', count: 1 });

        expect(sent).toEqual([]);
    });

    it('track() picks the key up on the next call: off, then on again, with no reload', async () => {
        const { analytics, sent } = await loadedModule();

        analytics.track('before');
        localStorage.setItem('umami.disabled', 'true');
        analytics.track('while_off');
        localStorage.removeItem('umami.disabled');
        analytics.track('after');

        expect(sent.map(([event]) => event)).toEqual(['before', 'after']);
    });

    it('drops an event that was held while the tracker loaded when the visitor has opted out by then', async () => {
        vi.resetModules();
        const analytics = await import('./analytics');
        analytics.loadTracker();
        analytics.track('held');
        localStorage.setItem('umami.disabled', 'true');

        const sent: Array<[string, unknown]> = [];
        window.umami = { track: (event, data) => sent.push([event, data]), identify: vi.fn() };
        document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));

        expect(sent).toEqual([]);
    });
});
