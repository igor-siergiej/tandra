import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { identify, loadTracker, startReplay, stopReplay, track } from './analytics';

// Mock the config module so analytics can resolve getConfig().
const configState = vi.hoisted(() => ({
    value: {} as { analytics?: { host?: string; websiteId?: string; enabled?: boolean } } | null,
}));

vi.mock('./config', () => ({
    getConfig: () => {
        if (!configState.value) throw new Error('Configuration not loaded.');

        return configState.value;
    },
}));

describe('analytics', () => {
    beforeEach(() => {
        configState.value = {};
        delete window.umami;
        document.head.innerHTML = '';
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is a no-op when analytics config is missing', () => {
        configState.value = {};
        expect(() => track('item_added', { source: 'typed' })).not.toThrow();
        expect(document.querySelector('script[data-website-id]')).toBeNull();
    });

    it('is a no-op when analytics.enabled is false', () => {
        configState.value = {
            analytics: { host: 'https://analytics.imapps.uk', websiteId: 'abc', enabled: false },
        };
        track('item_added');
        expect(document.querySelector('script[data-website-id]')).toBeNull();
    });

    it('rejects non-http(s) hosts without injecting the script', () => {
        configState.value = {
            analytics: { host: 'javascript:alert(1)', websiteId: 'abc' },
        };
        track('item_added');
        expect(document.querySelector('script[data-website-id]')).toBeNull();
    });

    // Must run before any other test injects: the injected flag is module state.
    it('loads the tracker without claiming window.umami, and sends events fired while it loaded', () => {
        configState.value = {
            analytics: { host: 'https://app.tandra.uk/pulse/', websiteId: 'site-1' },
        };

        loadTracker();
        // `/try` enters guest mode on first load, before the script is in.
        track('guest_mode_entered', { entry: 'try_link' });

        const script = document.querySelector<HTMLScriptElement>('script[data-website-id="site-1"]');
        expect(script?.src).toBe('https://app.tandra.uk/pulse/p.js');
        expect(window.umami).toBeUndefined();

        // Umami's tracker only defines its API when window.umami is unset.
        const sent: Array<[string, unknown]> = [];
        window.umami ??= { track: (e, d) => sent.push([e, d]), identify: vi.fn() };
        script?.dispatchEvent(new Event('load'));

        track('item_added', { source: 'typed', count: 1 });
        expect(sent).toEqual([
            ['guest_mode_entered', { entry: 'try_link', isGuest: false }],
            ['item_added', { source: 'typed', count: 1, isGuest: false }],
        ]);

        // The heatmap recorder follows the tracker, never before it: it needs the tracker's session.
        const recorder = document.querySelector<HTMLScriptElement>('script[src$="/recorder.js"]');
        expect(recorder?.src).toBe('https://app.tandra.uk/pulse/recorder.js');
        expect(recorder?.dataset.websiteId).toBe('site-1');
    });

    it('forwards events to the loaded tracker', () => {
        configState.value = {
            analytics: { host: 'https://analytics.imapps.uk', websiteId: 'site-1' },
        };
        const calls: Array<[string, unknown]> = [];
        window.umami = { track: (e, d) => calls.push([e, d]), identify: vi.fn() };

        track('item_added', { source: 'typed', count: 1 });
        localStorage.setItem('tandra:guest-mode', '1');
        track('list_cleared');

        expect(calls).toEqual([
            ['item_added', { source: 'typed', count: 1, isGuest: false }],
            ['list_cleared', { isGuest: true }],
        ]);
    });

    it('identify() forwards to window.umami.identify', () => {
        configState.value = {
            analytics: { host: 'https://analytics.imapps.uk', websiteId: 'site-1' },
        };
        const identifyMock = vi.fn();
        window.umami = { track: vi.fn(), identify: identifyMock };

        identify('user-123');
        expect(identifyMock).toHaveBeenCalledWith('user-123');
    });

    it('startReplay/stopReplay are no-ops when the tracker lacks the methods', () => {
        configState.value = {
            analytics: { host: 'https://analytics.imapps.uk', websiteId: 'site-1' },
        };
        window.umami = { track: vi.fn(), identify: vi.fn() };
        expect(() => startReplay()).not.toThrow();
        expect(() => stopReplay()).not.toThrow();
    });
});

describe('analytics opt-out', () => {
    afterEach(() => {
        localStorage.clear();
        document.head.innerHTML = '';
    });

    it('skips the heatmap recorder when the visitor opted out via umami.disabled', async () => {
        // Fresh module: the injected flags are module state and the suite above already injected.
        vi.resetModules();
        const fresh = await import('./analytics');
        configState.value = { analytics: { host: 'https://app.tandra.uk/pulse', websiteId: 'site-1' } };
        localStorage.setItem('umami.disabled', '1');

        fresh.loadTracker();
        document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));

        expect(document.querySelector('script[src$="/recorder.js"]')).toBeNull();
    });
});

describe('analytics list-path redaction', () => {
    const originalFetch = window.fetch;

    afterEach(() => {
        window.fetch = originalFetch;
        document.head.innerHTML = '';
    });

    it('rewrites list paths in what the tracker and recorder send, and leaves every other request alone', async () => {
        // Fresh module: injection runs once per module instance, and the suites above already injected.
        vi.resetModules();
        const fresh = await import('./analytics');
        const sent = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'));
        window.fetch = sent;
        configState.value = { analytics: { host: 'https://app.tandra.uk/pulse/', websiteId: 'site-1' } };
        fresh.loadTracker();

        const view = JSON.stringify({
            payload: { url: '/list/Mum%27s%2070th/l-1', referrer: '/list/l-2?x=1', title: 'Tandra' },
        });

        const clicks = JSON.stringify({ payload: { events: [{ url: 'https://app.tandra.uk/list/l-3' }] } });
        await fetch('https://app.tandra.uk/pulse/p', { method: 'POST', body: view, keepalive: true });
        await fetch('https://app.tandra.uk/pulse/api/record', { method: 'POST', body: clicks });
        await fetch('/api/lists/l-1/items', { method: 'PUT', body: '{"path":"/list/l-1"}' });

        const bodies = sent.mock.calls.map(([, init]) => init?.body);
        expect(bodies).toEqual([
            JSON.stringify({ payload: { url: '/list/:list', referrer: '/list/:list?x=1', title: 'Tandra' } }),
            JSON.stringify({ payload: { events: [{ url: 'https://app.tandra.uk/list/:list' }] } }),
            '{"path":"/list/l-1"}',
        ]);
        expect(sent.mock.calls[0][1]?.keepalive).toBe(true);
    });
});
