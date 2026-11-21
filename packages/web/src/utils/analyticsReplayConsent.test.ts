import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('./config', () => ({
    getConfig: () => ({ analytics: { host: 'https://app.tandra.uk/pulse', websiteId: 'site-1' } }),
}));

// Dynamic import on purpose: the injected flags are module state, so each page load needs a fresh module instance.
// A page load where the tracker and the recorder have both "loaded"; returns how often replay was started.
const loadPage = async (): Promise<number> => {
    vi.resetModules();
    const analytics = await import('./analytics');
    const startSessionReplay = vi.fn();
    analytics.loadTracker();
    window.umami = { track: vi.fn(), identify: vi.fn(), startSessionReplay };
    document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));
    document.querySelector('script[src$="/recorder.js"]')?.dispatchEvent(new Event('load'));

    return startSessionReplay.mock.calls.length;
};

describe('session replay resumes on page load only with consent', () => {
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

    it.each([
        ['no consent saved', {}, 0],
        ['consent saved', { 'tandra.replayConsent': 'true' }, 1],
        ['consent withdrawn', { 'tandra.replayConsent': 'false' }, 0],
        ['consent saved but usage statistics off', { 'tandra.replayConsent': 'true', 'umami.disabled': 'true' }, 0],
    ])('%s', async (_name, stored, started) => {
        for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);

        expect(await loadPage()).toBe(started);
    });
});

describe('session replay for a visitor who loaded the page opted out', () => {
    beforeEach(() => {
        delete window.umami;
        document.head.innerHTML = '';
        localStorage.clear();
    });

    it('loads the recorder and starts replay once they turn usage statistics and recordings on', async () => {
        localStorage.setItem('umami.disabled', 'true');
        vi.resetModules();
        // Dynamic import on purpose: the injected flags are module state, so this page load needs a fresh module instance.
        const analytics = await import('./analytics');
        const startSessionReplay = vi.fn();
        analytics.loadTracker();
        window.umami = { track: vi.fn(), identify: vi.fn(), startSessionReplay };
        document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));
        expect(document.querySelector('script[src$="/recorder.js"]')).toBeNull();

        localStorage.removeItem('umami.disabled');
        localStorage.setItem('tandra.replayConsent', 'true');
        analytics.startReplay();
        // Usage opt-out defers the tracker itself; its first load now follows consent restoration.
        document.querySelector('script[src$="/p.js"]')?.dispatchEvent(new Event('load'));
        expect(document.querySelectorAll('script[src$="/recorder.js"]')).toHaveLength(1);
        expect(startSessionReplay).not.toHaveBeenCalled();

        document.querySelector('script[src$="/recorder.js"]')?.dispatchEvent(new Event('load'));
        expect(startSessionReplay).toHaveBeenCalledTimes(1);

        analytics.startReplay();
        expect(document.querySelectorAll('script[src$="/recorder.js"]')).toHaveLength(1);
        expect(startSessionReplay).toHaveBeenCalledTimes(2);
    });
});
