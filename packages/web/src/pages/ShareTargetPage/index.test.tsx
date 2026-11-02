import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ShareTargetPage from './index';

const renderAt = (path: string) => {
    const router = createMemoryRouter(
        [
            { path: '/share', element: <ShareTargetPage /> },
            { path: '/recipes', element: <div>recipes page</div> },
        ],
        { initialEntries: [path] }
    );
    render(<RouterProvider router={router} />);
    return router;
};

describe('ShareTargetPage', () => {
    it('carries an explicit url param through to /recipes', () => {
        const router = renderAt('/share?url=https://example.com/recipe&title=Test');
        expect(router.state.location.pathname).toBe('/recipes');
        const params = new URLSearchParams(router.state.location.search);
        expect(params.get('sharedUrl')).toBe('https://example.com/recipe');
        expect(params.get('sharedTitle')).toBe('Test');
    });

    it('falls back to extracting the url from the text param (Android share behaviour)', () => {
        const router = renderAt('/share?text=https://example.com/recipe&title=Test');
        const params = new URLSearchParams(router.state.location.search);
        expect(params.get('sharedUrl')).toBe('https://example.com/recipe');
    });

    it('falls back to extracting the url from the title param when text is also empty', () => {
        const router = renderAt('/share?title=Check+this+out+https://example.com/recipe');
        const params = new URLSearchParams(router.state.location.search);
        expect(params.get('sharedUrl')).toBe('https://example.com/recipe');
    });

    it('redirects to /recipes without a sharedUrl when no url can be found', () => {
        const router = renderAt('/share?title=Test+Recipe');
        expect(router.state.location.pathname).toBe('/recipes');
        const params = new URLSearchParams(router.state.location.search);
        expect(params.get('sharedUrl')).toBeNull();
    });
});
