import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { fake } from './testing/fake';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Default /api/features response: every AI feature on, unless a test
// overrides the response. The web's useAiFeatures hook polls this on
// mount; without it, the hook defaults to all-false and AI controls
// (import-from-link, ingredient substitutes) get disabled in tests.
beforeEach(() => {
    globalThis.fetch = fake<typeof fetch>(
        vi.fn(async (input: RequestInfo | URL) => {
            const url = input instanceof Request ? input.url : String(input);

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
        })
    );
});

// Mock PointerEvent - jsdom doesn't have it
if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', {
        configurable: true,
        writable: true,
        value: class PointerEvent extends Event {
            constructor(
                type: string,
                public options: PointerEventInit = {}
            ) {
                super(type);
            }
        },
    });
}

// Mock URL.createObjectURL and revokeObjectURL (jsdom has URL but not these)
URL.createObjectURL = vi.fn(() => 'blob:mock-url');

URL.revokeObjectURL = vi.fn();

// Mock navigator.vibrate (not supported in jsdom)
Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    value: vi.fn(),
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
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
