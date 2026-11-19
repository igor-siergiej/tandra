import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { Context } from 'hono';

import * as imageHandlers from './index';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies', () => ({
    dependencyContainer: mockDependencyContainer,
}));

// The privacy notice promises logs hold no list-item text: the item an image was requested for must not be logged.
const ITEM_NAME = 'dragonfruit-item-name';

const mockImageService = { getImage: vi.fn() };
const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

type HonoVars = { Variables: { user: { id: string; username: string } } };

const createContext = (name: string) =>
    ({
        req: { param: (key: string) => (key === 'name' ? name : undefined), header: (): undefined => undefined },
        header: vi.fn(),
        json: (body: unknown, status: number) =>
            new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
        body: (stream: unknown) => new Response(stream as BodyInit),
        get: (key: string) => (key === 'user' ? { id: 'user-1', username: 'testuser' } : undefined),
    }) as unknown as Context<HonoVars>;

const loggedText = (): string =>
    JSON.stringify(
        [mockLogger.info, mockLogger.warn, mockLogger.error, mockLogger.debug].flatMap((fn) => fn.mock.calls)
    ).toLowerCase();

describe('ImageHandlers logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockImplementation((token: string) => {
            if (token === 'ImageService') return mockImageService;

            if (token === 'Logger') return mockLogger;

            return null;
        });
    });

    it('should log no item name when an item image is served', async () => {
        mockImageService.getImage.mockResolvedValue({
            stream: { pipe: vi.fn(), on: vi.fn(), read: vi.fn(), [Symbol.asyncIterator]: vi.fn() },
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });

        await imageHandlers.getImage(createContext(ITEM_NAME));

        expect(mockLogger.info).toHaveBeenCalled();
        expect(loggedText()).not.toContain(ITEM_NAME);
    });

    it('should log no item name when serving an item image fails', async () => {
        mockImageService.getImage.mockRejectedValue(
            Object.assign(new Error('Image storage unavailable'), { status: 503 })
        );

        const response = await imageHandlers.getImage(createContext(ITEM_NAME));

        expect(response.status).toBe(503);
        expect(mockLogger.error).toHaveBeenCalled();
        expect(loggedText()).not.toContain(ITEM_NAME);
    });
});
