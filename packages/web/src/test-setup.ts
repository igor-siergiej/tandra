import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vite-plus/test';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Default /api/features response: every AI feature on, unless a test
// overrides the response. The web's useAiFeatures hook polls this on
// mount; without it, the hook defaults to all-false and AI controls
// (import-from-link, ingredient substitutes) get disabled in tests.
beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/api/features')) {
            return new Response(
                JSON.stringify({
                    imageGeneration: true,
                    recipeImport: true,
                    ingredientSubstitutes: true,
                    itemCategorisation: true,
                    itemParse: true,
                    recipeTagger: true,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response('', { status: 404 });
    }) as unknown as typeof fetch;
});

// Mock PointerEvent - jsdom doesn't have it
if (typeof window !== 'undefined' && !window.PointerEvent) {
    (window as unknown as { PointerEvent: typeof Event }).PointerEvent = class PointerEvent extends Event {
        constructor(
            type: string,
            public options: Record<string, unknown> = {}
        ) {
            super(type);
        }
    };
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof URL !== 'undefined') {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
}

// Mock navigator.vibrate (not supported in jsdom)
Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    value: vi.fn(),
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
