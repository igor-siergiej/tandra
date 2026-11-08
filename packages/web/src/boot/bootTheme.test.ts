import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake } from '../testing/fake';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(__dirname, '../../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

const extractBootScript = (): string => {
    const match = indexHtml.match(/<script>\s*(\(function\(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);

    if (!match) {
        throw new Error('Could not find boot theme IIFE in index.html');
    }

    return match[1];
};

const bootScript = extractBootScript();

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

describe('boot theme script (index.html)', () => {
    beforeEach(() => {
        document.head.innerHTML = '<meta name="theme-color" content="#2e7d32" />';
        document.documentElement.className = '';
        document.documentElement.removeAttribute('style');
        localStorage.clear();
        setSystemPrefersDark(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('applies dark theme-color, class, and bg var when localStorage has "dark"', () => {
        localStorage.setItem('theme', 'dark');

        // eslint-disable-next-line no-new-func
        new Function(bootScript)();

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.style.getPropertyValue('--initial-bg')).toBe('#1a1a1a');
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#1a1a1a');
    });

    it('applies light theme-color, class, and bg var when localStorage has "light"', () => {
        localStorage.setItem('theme', 'light');

        // eslint-disable-next-line no-new-func
        new Function(bootScript)();

        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.style.getPropertyValue('--initial-bg')).toBe('oklch(0.96 0.015 80)');
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#2e7d32');
    });

    it('falls back to system dark preference when nothing is stored', () => {
        setSystemPrefersDark(true);

        // eslint-disable-next-line no-new-func
        new Function(bootScript)();

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#1a1a1a');
    });
});
