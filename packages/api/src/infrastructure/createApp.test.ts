import { expect, it, mock } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import { APIError } from '@imapps/api-utils/hono';

import { createApp } from './createApp';

it.each([
    ['/api/lists/:title/items', '/api/lists/private-household-menu/items'],
    ['/api/image/:name', '/api/image/private-tamarind-item'],
    ['/api/recipes/:recipeId', '/api/recipes/recipe-119?ingredients=private-cardamom'],
    ['unmatched', '/private-voice-transcript'],
])('logs the route template rather than content in %s', async (route, path) => {
    const logger = { info: mock(), warn: mock(), error: mock(), debug: mock() };
    const app = createApp({ logger: logger as unknown as Logger, allowedOrigins: ['https://example.com'] });

    if (route !== 'unmatched') app.get(route, (c) => c.json({ ok: true }));
    const response = await app.request(path);
    expect(response.status).toBe(route === 'unmatched' ? 404 : 200);
    expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ route, status: response.status })
    );
    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain('private-');
});

it('keeps credentialed CORS and API error responses', async () => {
    const app = createApp({ logger: { info: mock() } as unknown as Logger, allowedOrigins: ['https://example.com'] });
    app.get('/fail', () => {
        throw new APIError('Not found', 404);
    });
    const response = await app.request('/fail', { headers: { Origin: 'https://example.com' } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    const denied = await app.request('/fail', { headers: { Origin: 'https://other.example.com' } });
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
});
