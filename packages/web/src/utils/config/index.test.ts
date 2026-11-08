import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake } from '../../testing/fake';
import { loadConfig } from './index';

const mockFetch = (impl: () => Promise<Response>) => {
    vi.stubGlobal('fetch', vi.fn(impl));
};

describe('loadConfig', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('resolves with fetched config and caches it for offline use', async () => {
        mockFetch(() =>
            Promise.resolve(
                fake<Response>({
                    ok: true,
                    json: () => Promise.resolve({ analytics: { host: 'https://stats.example.com' } }),
                })
            )
        );

        const config = await loadConfig();

        expect(config).toEqual({ analytics: { host: 'https://stats.example.com' } });
        expect(localStorage.getItem('tandra:config')).toContain('https://stats.example.com');
    });

    it('falls back to the cached config when offline instead of throwing', async () => {
        localStorage.setItem('tandra:config', JSON.stringify({ analytics: { host: 'https://cached.example.com' } }));
        mockFetch(() => Promise.reject(new Error('network error')));

        const config = await loadConfig();

        expect(config).toEqual({ analytics: { host: 'https://cached.example.com' } });
    });

    it('throws when the fetch fails and there is no cached config', async () => {
        mockFetch(() => Promise.reject(new Error('network error')));

        await expect(loadConfig()).rejects.toThrow('Configuration failed to load');
    });
});
