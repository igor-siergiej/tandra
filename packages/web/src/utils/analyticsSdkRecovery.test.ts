import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import trackerSource from '../../../../e2e/mocks/data/umami-tracker.js?raw';

vi.mock('./config', () => ({
    getConfig: () => ({ analytics: { host: 'https://app.tandra.uk/pulse', websiteId: 'site-1' } }),
}));

describe('consent recovery with the real Umami tracker', () => {
    const storage = localStorage;
    const originalFetch = window.fetch;
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    let clickListeners: EventListener[];

    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        storage.clear();
        vi.stubGlobal('localStorage', {
            getItem: storage.getItem.bind(storage),
            setItem: storage.setItem.bind(storage),
            removeItem: storage.removeItem.bind(storage),
        });
        delete window.umami;
        document.head.innerHTML = '';
        window.history.replaceState({}, '', '/settings');
        clickListeners = [];
        const addEventListener = document.addEventListener.bind(document);
        vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
            if (type === 'click') clickListeners.push(listener as EventListener);
            addEventListener(type, listener, options);
        });
    });

    afterEach(() => {
        for (const listener of clickListeners) document.removeEventListener('click', listener, true);
        window.history.pushState = pushState;
        window.history.replaceState = replaceState;
        window.fetch = originalFetch;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it.each([
        { name: 'opted-out startup', phase: 'startup', failRemoval: false, readyState: 'complete' },
        { name: 'failed opt-in after startup', phase: 'startup', failRemoval: true, readyState: 'complete' },
        { name: 'failed opt-in after initialization', phase: 'initialized', failRemoval: true, readyState: 'complete' },
        {
            name: 'opt-out during download after document completion',
            phase: 'downloading',
            failRemoval: false,
            readyState: 'complete',
        },
        {
            name: 'opt-out during download before document completion',
            phase: 'downloading',
            failRemoval: false,
            readyState: 'loading',
        },
        {
            name: 'opt-in again before the download finishes',
            phase: 'reenabled',
            failRemoval: false,
            readyState: 'complete',
        },
        { name: 'opt-out after initialization', phase: 'initialized', failRemoval: false, readyState: 'complete' },
    ])('restores real page views and click tracking: $name', async ({ phase, failRemoval, readyState }) => {
        const hits: Array<{ payload: { name?: string; url: string } }> = [];
        window.fetch = vi.fn(async (_input, init) => {
            hits.push(JSON.parse(String(init?.body)));

            return new Response('{}');
        });
        // Fresh imports exercise page initialization; static imports retain the previous case's SDK state.
        const analytics = await import('./analytics');
        const consent = await import('./analyticsConsent');
        const ready = vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
        const executed = new Set<Element>();

        const executeDownloads = () => {
            for (const script of document.querySelectorAll<HTMLScriptElement>('script[src$="/p.js"]')) {
                if (executed.has(script)) continue;
                executed.add(script);
                const currentScript = vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
                // Execute the vendored SDK, including its own storage guard and history/click hooks.
                new Function('window', 'fetch', trackerSource)(window, window.fetch);
                currentScript.mockRestore();
                script.dispatchEvent(new Event('load'));
            }
        };

        if (phase !== 'startup') analytics.loadTracker();

        if (phase === 'initialized') executeDownloads();
        consent.setUsageOptedOut(true);
        const beforeOptOut = hits.length;
        analytics.track('while_disabled');

        if (phase === 'downloading') {
            ready.mockReturnValue(readyState as DocumentReadyState);
            executeDownloads();
            ready.mockReturnValue('complete');
            document.dispatchEvent(new Event('readystatechange'));
        }

        expect(hits).toHaveLength(beforeOptOut);

        if (failRemoval) {
            const failure = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
                throw new Error('Storage unavailable');
            });

            consent.setUsageOptedOut(false);
            analytics.loadTracker();
            analytics.track('failed_opt_in');
            expect(localStorage.getItem('umami.disabled')).toBe('true');
            // Do not claim usage is enabled while the SDK is still disabled by persisted storage.
            expect(consent.isUsageOptedOut()).toBe(true);
            expect(consent.hasUnsavedAnalyticsChoices()).toBe(true);
            expect(hits).toHaveLength(beforeOptOut);
            failure.mockRestore();
        }

        consent.setUsageOptedOut(false);
        analytics.loadTracker();
        executeDownloads();
        expect(consent.isUsageOptedOut()).toBe(false);
        expect(consent.hasUnsavedAnalyticsChoices()).toBe(false);
        expect(hits.some((hit) => !hit.payload.name && new URL(hit.payload.url).pathname === '/settings')).toBe(true);

        for (const path of ['/calendar', '/recipes']) {
            window.history.pushState({}, '', path);
            await vi.advanceTimersByTimeAsync(300);
            expect(hits.filter((hit) => !hit.payload.name && new URL(hit.payload.url).pathname === path)).toHaveLength(
                1
            );
        }

        const button = document.createElement('button');
        button.dataset.umamiEvent = 'recovered_click';
        document.body.appendChild(button);
        button.click();
        button.remove();
        await vi.advanceTimersByTimeAsync(0);
        expect(hits.filter((hit) => hit.payload.name === 'recovered_click')).toHaveLength(1);
    });
});
