import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake } from '../testing/fake';
import { applyManifestForTheme } from './applyManifestForTheme';

const setSystemPrefersDark = (matches: boolean) => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
        fake<MediaQueryList>({
            matches,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })
    );
};

describe('applyManifestForTheme', () => {
    beforeEach(() => {
        document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">';
        localStorage.clear();
        setSystemPrefersDark(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('points the manifest link at the dark manifest when theme is "dark"', () => {
        localStorage.setItem('theme', 'dark');

        applyManifestForTheme();

        expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-dark.webmanifest');
    });

    it('points the manifest link at the light manifest when theme is "light"', () => {
        localStorage.setItem('theme', 'light');

        applyManifestForTheme();

        expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.webmanifest');
    });

    it('falls back to system preference when nothing is stored', () => {
        setSystemPrefersDark(true);

        applyManifestForTheme();

        expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-dark.webmanifest');
    });

    it('does nothing if no manifest link exists', () => {
        document.head.innerHTML = '';
        localStorage.setItem('theme', 'dark');

        expect(() => applyManifestForTheme()).not.toThrow();
    });
});
