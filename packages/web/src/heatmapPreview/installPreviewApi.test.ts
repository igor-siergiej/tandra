import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { installPreviewApi } from './installPreviewApi';

describe('installPreviewApi', () => {
    const originalFetch = window.fetch;
    const realFetch = vi.fn(async () => new Response('real'));

    beforeEach(() => {
        realFetch.mockClear();
        window.fetch = realFetch;
        installPreviewApi();
    });

    afterEach(() => {
        window.fetch = originalFetch;
    });

    it('answers the session check with the placeholder user, without the real api', async () => {
        const response = await fetch('/api/auth/get-session');

        expect(await response.json()).toEqual({ user: { id: 'preview-user', username: expect.any(String) } });
        expect(realFetch).not.toHaveBeenCalled();
    });

    it('refuses writes and unknown api routes instead of forwarding them', async () => {
        const write = await fetch('/api/lists/abc/items', { method: 'PUT', body: '{}' });

        const unknown = await fetch(
            new Request(`${window.location.origin}/api/lists/abc/socket-ticket`, { method: 'POST' })
        );

        expect([write.status, unknown.status]).toEqual([404, 404]);
        expect(realFetch).not.toHaveBeenCalled();
    });

    it('serves any recipe id the dashboard opens, under that id', async () => {
        const recipe = await (await fetch('/api/recipes/visitor%20recipe')).json();

        expect(recipe.id).toBe('visitor recipe');
    });

    it('forwards non-api requests and the public feature flags', async () => {
        await fetch('/config.json');
        await fetch('/api/features');
        await fetch('https://fonts.googleapis.com/css2');

        expect(realFetch).toHaveBeenCalledTimes(3);
    });
});
