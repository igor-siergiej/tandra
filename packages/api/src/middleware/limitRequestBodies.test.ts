import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';

import { limitRequestBodies } from './limitRequestBodies';

const app = new Hono();
app.use('/api/*', limitRequestBodies);
app.post('/api/logs', async (c) => c.json({ bytes: (await c.req.text()).length }));
app.post('/api/recipes/:id/image/upload', async (c) => c.json({ bytes: (await c.req.arrayBuffer()).byteLength }));

const post = (path: string, bytes: number) =>
    app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'a'.repeat(bytes) });

describe('limitRequestBodies', () => {
    it('accepts an ordinary body', async () => {
        expect((await post('/api/logs', 10_000)).status).toBe(200);
    });

    it('refuses a body over 1 MB', async () => {
        expect((await post('/api/logs', 1024 * 1024 + 1)).status).toBe(413);
    });

    it('leaves image uploads to their own route limit', async () => {
        expect((await post('/api/recipes/r1/image/upload', 2 * 1024 * 1024)).status).toBe(200);
    });
});
