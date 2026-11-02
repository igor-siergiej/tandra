import { describe, expect, it } from 'bun:test';

import { Hono } from 'hono';

import { csrfForFormPosts } from './csrf';

const ORIGINS = ['http://localhost:4000', 'https://app.tandra.uk'];

/**
 * The CSRF wrapper is the guard that cookie-authenticated mutating routes depend on. It has
 * to reject a cross-site form post, and it has to let through the bodyless verbs our own
 * routes use (issue/revoke an invite, delete a list) — those send no Content-Type at all,
 * which `hono/csrf` would otherwise read as a `text/plain` simple request and reject.
 */
const appWithCsrf = () => {
    const app = new Hono();
    app.use('/api/*', csrfForFormPosts(ORIGINS));
    app.post('/api/lists/:title/invites', (c) => c.json({ ok: true }, 201));
    app.delete('/api/lists/:title/invites/:token', (c) => c.body(null, 204));
    app.put('/api/lists', (c) => c.json({ ok: true }, 201));
    return app;
};

describe('csrfForFormPosts', () => {
    it('rejects a cross-origin form-encoded POST', async () => {
        const res = await appWithCsrf().request('/api/lists/Groceries/invites', {
            method: 'POST',
            headers: { Origin: 'https://evil.example', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'title=evil',
        });
        expect(res.status).toBe(403);
    });

    it('rejects a cross-origin multipart POST', async () => {
        const res = await appWithCsrf().request('/api/lists/Groceries/invites', {
            method: 'POST',
            headers: { Origin: 'https://evil.example', 'Content-Type': 'multipart/form-data; boundary=x' },
            body: '--x--',
        });
        expect(res.status).toBe(403);
    });

    it('allows a same-origin form-encoded POST', async () => {
        const res = await appWithCsrf().request('/api/lists/Groceries/invites', {
            method: 'POST',
            headers: { Origin: 'http://localhost:4000', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'title=ok',
        });
        expect(res.status).toBe(201);
    });

    it('allows a bodyless POST with no Content-Type (issue-invite verb)', async () => {
        const res = await appWithCsrf().request('/api/lists/Groceries/invites', { method: 'POST' });
        expect(res.status).toBe(201);
    });

    it('allows a bodyless DELETE with no Content-Type (revoke-invite verb)', async () => {
        const res = await appWithCsrf().request('/api/lists/Groceries/invites/abc123', { method: 'DELETE' });
        expect(res.status).toBe(204);
    });

    it('allows a bodyless PUT with no Content-Type (create-list verb)', async () => {
        const res = await appWithCsrf().request('/api/lists', { method: 'PUT' });
        expect(res.status).toBe(201);
    });

    it('still rejects a cross-origin form POST when the request also carries an Origin the browser would strip', async () => {
        // sec-fetch-site is the browser's own signal; when it says cross-site, the Origin check
        // cannot rescue the request.
        const res = await appWithCsrf().request('/api/lists/Groceries/invites', {
            method: 'POST',
            headers: {
                'Sec-Fetch-Site': 'cross-site',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'title=evil',
        });
        expect(res.status).toBe(403);
    });
});
