import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('./config', () => ({
    getConfig: () => ({ analytics: { host: 'https://app.tandra.uk/pulse', websiteId: 'site-1' } }),
}));

describe('usage tracking after an opted-out startup', () => {
    const originalFetch = window.fetch;
    beforeEach(() => {
        // A new page must not reuse tracker initialization flags from the last case.
        vi.resetModules();
        localStorage.clear();
        delete window.umami;
        document.head.innerHTML = '';
    });
    afterEach(() => {
        window.fetch = originalFetch;
    });

    it.each([false, true])('loads aggregate tracking on opt-in, with replay consent %s', async (replayConsent) => {
        localStorage.setItem('umami.disabled', 'true');
        localStorage.setItem('tandra.replayConsent', String(replayConsent));
        // Static imports would preserve the previous page's injection state.
        const analytics = await import('./analytics');
        analytics.loadTracker();
        expect(document.querySelector('script[src$="/p.js"]')).toBeNull();

        localStorage.removeItem('umami.disabled');
        analytics.loadTracker();
        const tracker = document.querySelector('script[src$="/p.js"]');
        expect(tracker).not.toBeNull();
        const startSessionReplay = vi.fn();
        window.umami = { track: vi.fn(), identify: vi.fn(), startSessionReplay };
        tracker?.dispatchEvent(new Event('load'));
        const recorder = document.querySelector('script[src$="/recorder.js"]');
        expect(recorder).not.toBeNull();
        recorder?.dispatchEvent(new Event('load'));
        expect(startSessionReplay).toHaveBeenCalledTimes(replayConsent ? 1 : 0);
        analytics.loadTracker();
        expect(document.querySelectorAll('script[src$="/p.js"]')).toHaveLength(1);
        expect(document.querySelectorAll('script[src$="/recorder.js"]')).toHaveLength(1);
    });
});
