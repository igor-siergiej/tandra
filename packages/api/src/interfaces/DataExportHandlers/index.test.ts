import { describe, expect, it, vi } from 'bun:test';

import { Hono } from 'hono';

const exportFor = vi.fn(async () => ({ meta: { exportedAt: '2030-02-03T10:00:00.000Z' }, lists: [] }));

vi.mock('../../dependencies/container', () => ({ dependencyContainer: { resolve: () => ({ exportFor }) } }));

import type { HonoVars } from '../handlerUtils';
import { exportFilename, exportMyData } from './index';

describe('exportFilename', () => {
    it('is tandra-export-<username>-<date>.json with unsafe username characters replaced', () => {
        expect(exportFilename('igor', '2030-02-03T10:00:00.000Z')).toBe('tandra-export-igor-2030-02-03.json');
        expect(exportFilename('a"b/c d', '2030-02-03T10:00:00.000Z')).toBe('tandra-export-a_b_c_d-2030-02-03.json');
    });
});

describe('exportMyData', () => {
    const app = (user?: { id: string; username: string }) => {
        const router = new Hono<HonoVars>();
        router.use('*', async (c, next) => {
            if (user) c.set('user', user);

            await next();
        });
        router.get('/api/export', exportMyData);

        return router;
    };

    it('refuses a caller without a user and reads no data', async () => {
        const response = await app().request('/api/export');

        expect(response.status).toBe(401);
        expect(exportFor).not.toHaveBeenCalled();
    });

    it('serves the export as a non-cacheable attachment named after the user', async () => {
        const response = await app({ id: 'u1', username: 'igor' }).request('/api/export');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="tandra-export-igor-2030-02-03.json"'
        );
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toMatchObject({ lists: [] });
    });
});
