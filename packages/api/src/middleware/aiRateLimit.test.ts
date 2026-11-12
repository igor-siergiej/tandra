import { describe, expect, it } from 'bun:test';

import { Hono } from 'hono';

import { aiRateLimit } from './aiRateLimit';

const app = (userId?: string) => {
    const a = new Hono<{ Variables: { user: { id: string; username: string } } }>();
    a.use('*', async (c, next) => {
        if (userId) c.set('user', { id: userId, username: 'u' });
        await next();
    });
    a.post('/ai', aiRateLimit, (c) => c.json({ ok: true }));

    return a;
};

describe('aiRateLimit', () => {
    it('returns a friendly 429 with Retry-After after 60 calls in the window, per user', async () => {
        const a = app('limit-user');

        for (let i = 0; i < 60; i++) {
            expect((await a.request('/ai', { method: 'POST' })).status).toBe(200);
        }

        const res = await a.request('/ai', { method: 'POST' });

        expect(res.status).toBe(429);
        expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
        expect(((await res.json()) as { error: string }).error).toContain('try again');
        expect((await app('other-user').request('/ai', { method: 'POST' })).status).toBe(200);
    });

    it('passes through when there is no authenticated user (auth middleware owns that case)', async () => {
        expect((await app().request('/ai', { method: 'POST' })).status).toBe(200);
    });
});
