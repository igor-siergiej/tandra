import { describe, expect, it } from 'bun:test';

import { Hono } from 'hono';
import { z } from 'zod';

import { validateJson } from './validate';

const schema = z.object({ name: z.string().trim().min(1, 'is required'), count: z.number().optional() });

const app = (options?: { optional?: boolean }) => {
    const a = new Hono();
    a.post('/x', validateJson(schema, options), async (c) =>
        c.json({ received: await c.req.json().catch(() => null) })
    );

    return a;
};

const post = (a: Hono, body?: string) =>
    a.request('/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

/** The 400 body validateJson answers with. */
const errorBody = z.object({ error: z.string(), fields: z.record(z.string(), z.string()) });

describe('validateJson', () => {
    it('lets a valid body through, and the handler can still read it', async () => {
        const res = await post(app(), JSON.stringify({ name: 'milk', extra: 1 }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: { name: 'milk', extra: 1 } });
    });

    it('rejects an invalid body with 400 and a per-field error map', async () => {
        const res = await post(app(), JSON.stringify({ name: '  ', count: 'two' }));
        const body = errorBody.parse(await res.json());

        expect(res.status).toBe(400);
        expect(Object.keys(body.fields).sort()).toEqual(['count', 'name']);
        expect(body.fields.name).toBe('is required');
        expect(body.error).toBe('name: is required');
    });

    it('rejects a body that is not JSON', async () => {
        const res = await post(app(), 'not json');

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'Request body must be valid JSON' });
    });

    it('treats a missing body as an empty object when the body is optional', async () => {
        const optionalSchema = z.object({ note: z.string().optional() });
        const a = new Hono();
        a.post('/x', validateJson(optionalSchema, { optional: true }), (c) => c.json({ ok: true }));

        expect((await post(a)).status).toBe(200);
        expect((await post(a, '{bad')).status).toBe(200);
    });

    it('still validates a present body on an optional route', async () => {
        const a = new Hono();
        a.post('/x', validateJson(z.object({ note: z.string() }), { optional: true }), (c) => c.json({ ok: true }));

        expect((await post(a, JSON.stringify({ note: 5 }))).status).toBe(400);
    });
});
