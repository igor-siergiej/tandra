import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';

import { directOnly } from './directOnly';

const app = new Hono();
app.get('/api/metrics', directOnly, (c) => c.text('ok'));

describe('directOnly', () => {
    it('serves a direct request', async () => {
        const res = await app.request('/api/metrics');
        expect(res.status).toBe(200);
    });

    it.each(['X-Forwarded-For', 'X-Real-IP', 'Forwarded', 'CF-Connecting-IP'])(
        'hides the endpoint from a request forwarded with %s',
        async (header) => {
            const res = await app.request('/api/metrics', { headers: { [header]: '203.0.113.7' } });
            expect(res.status).toBe(404);
        }
    );
});
