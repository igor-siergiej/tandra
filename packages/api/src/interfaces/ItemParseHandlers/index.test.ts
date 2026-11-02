import { beforeEach, describe, expect, it, vi } from 'bun:test';

const mockParser = { parse: vi.fn() };
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const mockDependencyContainer = {
    resolve: vi.fn((token: string) => (token === 'ItemTextParser' ? mockParser : mockLogger)),
};

vi.mock('../../dependencies', () => ({ dependencyContainer: mockDependencyContainer }));

import { parseSpokenItems } from './index';

const ctx = (body: unknown) =>
    ({
        req: { json: async () => body },
        get: () => ({ id: 'u1', username: 'a' }),
        json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
    }) as never;

describe('parseSpokenItems', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParser.parse.mockResolvedValue([{ name: 'bread', quantity: 2, unit: 'loaf' }, { name: 'milk' }]);
    });

    it('returns the parsed items without adding anything', async () => {
        const res = await parseSpokenItems(ctx({ transcript: 'two loaves of bread and milk' }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ items: [{ name: 'bread', quantity: 2, unit: 'loaf' }, { name: 'milk' }] });
    });

    it('truncates an over-long transcript before it reaches the LLM', async () => {
        await parseSpokenItems(ctx({ transcript: 'a'.repeat(5000) }));

        expect((mockParser.parse.mock.calls[0][0] as string).length).toBe(500);
    });

    it('caps how many items come back', async () => {
        mockParser.parse.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ name: `item${i}` })));

        const body = (await (await parseSpokenItems(ctx({ transcript: 'lots' }))).json()) as { items: unknown[] };

        expect(body.items).toHaveLength(30);
    });

    it('hides provider failures behind a generic error', async () => {
        mockParser.parse.mockRejectedValue(Object.assign(new Error('fal.ai any-llm error: secret'), { status: 502 }));

        await expect(parseSpokenItems(ctx({ transcript: 'milk' }))).rejects.toMatchObject({
            message: 'Could not understand that request',
            status: 502,
        });
    });
});
