import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// Each test represents a fresh page: static imports would retain failed-write overrides and injection state.
vi.mock('./config', () => ({
    getConfig: () => ({ analytics: { host: 'https://app.tandra.uk/pulse', websiteId: 'site-1' } }),
}));

describe('analytics choices when browser storage fails', () => {
    const originalFetch = window.fetch;
    const storage = localStorage;

    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        // Happy DOM's Storage proxy retains spies across restores; spy on an ordinary facade instead.
        vi.stubGlobal('localStorage', {
            getItem: storage.getItem.bind(storage),
            setItem: storage.setItem.bind(storage),
            removeItem: storage.removeItem.bind(storage),
        });
        document.head.innerHTML = '';
        delete window.umami;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        window.fetch = originalFetch;
        vi.unstubAllGlobals();
    });

    it.each([
        { name: 'usage opt-out', key: 'umami.disabled', initial: null, value: true, expected: true, choice: 'usage' },
        {
            name: 'usage opt-in',
            key: 'umami.disabled',
            initial: 'true',
            value: false,
            expected: false,
            choice: 'usage',
        },
        {
            name: 'replay opt-in',
            key: 'tandra.replayConsent',
            initial: 'false',
            value: true,
            expected: true,
            choice: 'replay',
        },
        {
            name: 'replay withdrawal',
            key: 'tandra.replayConsent',
            initial: 'true',
            value: false,
            expected: false,
            choice: 'replay',
        },
        {
            name: 'prompt dismissal',
            key: 'tandra.analyticsPromptSeen',
            initial: null,
            value: true,
            expected: true,
            choice: 'prompt',
        },
    ])(
        'keeps $name effective for this visit, including subsequent initialization',
        async ({ key, initial, value, expected, choice }) => {
            if (initial !== null) localStorage.setItem(key, initial);
            const consent = await import('./analyticsConsent');

            const choose = () => {
                if (choice === 'usage') consent.setUsageOptedOut(value);
                else if (choice === 'replay') consent.setReplayConsent(value);
                else consent.markConsentPromptSeen();
            };

            const read = () => {
                if (choice === 'usage') return consent.isUsageOptedOut();

                if (choice === 'replay') return consent.hasReplayConsent();

                return consent.hasSeenConsentPrompt();
            };

            const failure = vi
                .spyOn(localStorage, choice === 'usage' && !value ? 'removeItem' : 'setItem')
                .mockImplementation(() => {
                    throw new DOMException('Storage full', 'QuotaExceededError');
                });

            choose();
            expect(localStorage.getItem(key)).toBe(initial);
            expect(read()).toBe(expected);

            // Consumers must use the effective choice, not the stale persisted value.
            const sent = vi.fn();
            const startSessionReplay = vi.fn();
            const analytics = await import('./analytics');
            analytics.loadTracker();
            window.umami = { track: sent, identify: vi.fn(), startSessionReplay };
            document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));
            document.querySelector('script[src$="/recorder.js"]')?.dispatchEvent(new Event('load'));
            analytics.track('after_choice');
            expect(sent).toHaveBeenCalledTimes(consent.isUsageOptedOut() ? 0 : 1);
            expect(startSessionReplay).toHaveBeenCalledTimes(
                consent.hasReplayConsent() && !consent.isUsageOptedOut() ? 1 : 0
            );

            // Retrying after storage recovers persists the same choice.
            failure.mockRestore();
            choose();
            expect(localStorage.getItem(key)).toBe(choice === 'usage' ? (value ? 'true' : null) : String(value));
            expect(read()).toBe(expected);
        }
    );

    it('blocks automatic tracker and heatmap sends when persisting opt-out failed', async () => {
        const network = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'));
        window.fetch = network;
        const analytics = await import('./analytics');
        const consent = await import('./analyticsConsent');
        analytics.loadTracker();
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('Storage full');
        });
        consent.setUsageOptedOut(true);

        await window.fetch('https://app.tandra.uk/pulse/p', { method: 'POST', body: '{}' });
        await window.fetch('https://app.tandra.uk/pulse/api/record', { method: 'POST', body: '{}' });
        await window.fetch('/api/lists');

        expect(network.mock.calls).toEqual([['/api/lists', undefined]]);
    });

    it('does not assume usage consent when storage cannot be read', async () => {
        vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
            throw new Error('Storage unavailable');
        });
        const consent = await import('./analyticsConsent');
        expect(consent.isUsageOptedOut()).toBe(true);
        expect(consent.hasReplayConsent()).toBe(false);
    });
});
