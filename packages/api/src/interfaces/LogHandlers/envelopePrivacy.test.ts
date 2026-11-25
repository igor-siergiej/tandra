import { beforeEach, expect, it, mock } from 'bun:test';

import { Hono } from 'hono';

const logger = { info: mock(), warn: mock(), error: mock(), debug: mock() };

mock.module('../../dependencies', () => ({ dependencyContainer: { resolve: () => logger } }));

import { receiveLogs } from './index';

const app = new Hono().post('/logs', receiveLogs);

beforeEach(() => {
    for (const sink of Object.values(logger)) sink.mockReset();
});

it.each([
    { level: 'private-item-name', message: 'Failed' },
    {
        level: 'info',
        message: 'Item added',
        url: 'https://app.tandra.uk/list/private-list-title?ingredient=private-recipe-text#private-transcript',
    },
    {
        level: 'error',
        message: 'Failed to create recipe',
        context: { error: 'Write failed: private-recipe-text', errorMessage: 'private-item-name' },
    },
])('does not leak household text outside rejected context keys (%#)', async (body) => {
    const response = await app.request('/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.119' },
        body: JSON.stringify(body),
    });

    expect(response.status).toBe(body.level === 'private-item-name' ? 400 : 204);
    expect(JSON.stringify(Object.values(logger).flatMap((sink) => sink.mock.calls))).not.toContain('private-');
});

it('does not log an error from a sink that echoes its payload', async () => {
    logger.info.mockImplementationOnce(() => {
        throw new Error('private-recipe-text');
    });

    const response = await app.request('/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.119' },
        body: JSON.stringify({ level: 'info', message: 'Item added' }),
    });

    expect(response.status).toBe(500);
    expect(
        JSON.stringify(logger.error.mock.calls, (_key, value) =>
            value instanceof Error ? { message: value.message } : value
        )
    ).not.toContain('private-');
});
