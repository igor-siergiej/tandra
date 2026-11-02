import { beforeEach, describe, expect, it, vi } from 'bun:test';

import * as imageHandlers from './index';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies', () => ({
    dependencyContainer: mockDependencyContainer,
}));

const mockImageService = {
    getImage: vi.fn(),
} as {
    getImage: ReturnType<typeof vi.fn>;
};

const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
};

const mockRecipeService = {
    getRecipe: vi.fn(),
};

const mockBucketStore = {
    getHeadObject: vi.fn(),
    getObjectStream: vi.fn(),
    putObject: vi.fn(),
};

type HonoVars = { Variables: { user: { id: string; username: string } } };

const createMockContext = (params: Record<string, string> = {}, user?: { id: string; username: string }) => {
    const vars: Record<string, unknown> = {};

    if (user) vars.user = user;

    return {
        req: {
            param: (name: string) => params[name],
            header: (_name: string): undefined => undefined,
        },
        header: vi.fn(),
        json: vi.fn().mockImplementation(
            (body: unknown, status: number): Response =>
                new Response(JSON.stringify(body), {
                    status,
                    headers: { 'Content-Type': 'application/json' },
                })
        ),
        body: vi.fn().mockImplementation((stream: unknown) => new Response(stream as BodyInit)),
        get: (key: string) => vars[key],
        set: (key: string, val: unknown) => {
            vars[key] = val;
        },
    } as unknown as import('hono').Context<HonoVars>;
};

describe('ImageHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockImplementation((token: string) => {
            if (token === 'ImageService') return mockImageService;

            if (token === 'Logger') return mockLogger;

            if (token === 'ImageStore') return mockBucketStore;

            if (token === 'RecipeService') return mockRecipeService;

            return null;
        });
    });

    describe('getImage', () => {
        it('should return image successfully', async () => {
            const mockNodeStream = {
                pipe: vi.fn(),
                on: vi.fn(),
                read: vi.fn(),
                [Symbol.asyncIterator]: vi.fn(),
            };

            const ctx = createMockContext({ name: 'test-image' });

            mockImageService.getImage.mockResolvedValue({
                stream: mockNodeStream,
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
            });

            const response = await imageHandlers.getImage(ctx);

            expect(mockImageService.getImage).toHaveBeenCalledWith('test-image', undefined);
            expect(ctx.header).toHaveBeenCalledWith('Content-Type', 'image/webp');
            expect(ctx.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000, immutable');
            expect(response).toBeDefined();
        });

        it('passes the authenticated user id so a cache miss can be generated', async () => {
            const ctx = createMockContext({ name: 'test-image' }, { id: 'user-1', username: 'u' });
            mockImageService.getImage.mockResolvedValue({
                stream: { pipe: vi.fn(), on: vi.fn(), read: vi.fn(), [Symbol.asyncIterator]: vi.fn() },
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
            });

            await imageHandlers.getImage(ctx);

            expect(mockImageService.getImage).toHaveBeenCalledWith('test-image', 'user-1');
        });

        it('should handle service errors with status code', async () => {
            const ctx = createMockContext({ name: 'invalid-image' });

            mockImageService.getImage.mockRejectedValue(Object.assign(new Error('Image not found'), { status: 404 }));

            const response = await imageHandlers.getImage(ctx);

            expect(response.status).toBe(404);
            expect(await response.json()).toEqual({ error: 'Image not found' });
        });

        it('should handle service errors without status code', async () => {
            const ctx = createMockContext({ name: 'test-image' });

            mockImageService.getImage.mockRejectedValue(new Error('Internal error'));

            const response = await imageHandlers.getImage(ctx);

            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ error: 'Internal error' });
        });

        it('should handle service errors without message', async () => {
            const ctx = createMockContext({ name: 'test-image' });

            mockImageService.getImage.mockRejectedValue({ status: 400 });

            const response = await imageHandlers.getImage(ctx);

            expect(response.status).toBe(400);
            expect(await response.json()).toEqual({ error: 'Internal Server Error' });
        });

        describe('recipe-image/* keys', () => {
            it('returns image from bucket without calling ImageService', async () => {
                const mockNodeStream = { pipe: vi.fn(), on: vi.fn() };
                mockBucketStore.getHeadObject.mockResolvedValue({ metaData: { 'content-type': 'image/webp' } });
                mockBucketStore.getObjectStream.mockResolvedValue(mockNodeStream);

                const ctx = createMockContext({ name: 'recipe-image/pasta' });
                const response = await imageHandlers.getImage(ctx);

                expect(mockImageService.getImage).not.toHaveBeenCalled();
                expect(ctx.header).toHaveBeenCalledWith('Content-Type', 'image/webp');
                expect(response).toBeDefined();
            });

            it('returns 404 when recipe image not in bucket', async () => {
                mockBucketStore.getHeadObject.mockRejectedValue(new Error('Not found'));

                const ctx = createMockContext({ name: 'recipe-image/pasta' });
                const response = await imageHandlers.getImage(ctx);

                expect(mockImageService.getImage).not.toHaveBeenCalled();
                expect(response.status).toBe(404);
            });
        });

        describe('recipe-upload/* keys', () => {
            it('returns 401 when no authenticated user', async () => {
                const ctx = createMockContext({ name: 'recipe-upload/user1/recipe1' });
                const response = await imageHandlers.getImage(ctx);

                expect(response.status).toBe(401);
            });

            const KEY = 'recipe-upload/user1/recipe1/1.webp';

            it('returns image from bucket for a member of the recipe that uses it as cover', async () => {
                mockRecipeService.getRecipe.mockResolvedValue({
                    coverImageKey: KEY,
                    users: [{ id: 'user1', username: 'alice' }],
                });
                const mockNodeStream = { pipe: vi.fn(), on: vi.fn() };
                mockBucketStore.getHeadObject.mockResolvedValue({ metaData: { 'content-type': 'image/webp' } });
                mockBucketStore.getObjectStream.mockResolvedValue(mockNodeStream);

                const ctx = createMockContext({ name: KEY }, { id: 'user1', username: 'alice' });
                const response = await imageHandlers.getImage(ctx);

                expect(ctx.header).toHaveBeenCalledWith('Content-Type', 'image/webp');
                // Member-only image: a shared cache (CDN, proxy) must never store it for other requesters.
                expect(ctx.header).toHaveBeenCalledWith('Cache-Control', 'private, max-age=31536000, immutable');
                expect(response).toBeDefined();
            });

            it('returns 404 for a logged-in user who is not a member of the recipe', async () => {
                mockRecipeService.getRecipe.mockResolvedValue({
                    coverImageKey: KEY,
                    users: [{ id: 'someone-else', username: 'bob' }],
                });

                const ctx = createMockContext({ name: KEY }, { id: 'user1', username: 'alice' });
                const response = await imageHandlers.getImage(ctx);

                expect(response.status).toBe(404);
                expect(mockBucketStore.getObjectStream).not.toHaveBeenCalled();
            });

            it('returns 404 once the recipe no longer uses that key', async () => {
                mockRecipeService.getRecipe.mockResolvedValue({
                    coverImageKey: 'recipe-upload/user1/recipe1/2.webp',
                    users: [{ id: 'user1', username: 'alice' }],
                });

                const ctx = createMockContext({ name: KEY }, { id: 'user1', username: 'alice' });
                const response = await imageHandlers.getImage(ctx);

                expect(response.status).toBe(404);
            });

            it('returns 404 when the recipe cannot be loaded', async () => {
                mockRecipeService.getRecipe.mockRejectedValue(new Error('not found'));

                const ctx = createMockContext({ name: KEY }, { id: 'user1', username: 'alice' });
                const response = await imageHandlers.getImage(ctx);

                expect(response.status).toBe(404);
            });

            it('returns 404 when stored image not found', async () => {
                mockRecipeService.getRecipe.mockResolvedValue({
                    coverImageKey: KEY,
                    users: [{ id: 'user1', username: 'alice' }],
                });
                mockBucketStore.getHeadObject.mockResolvedValue(null);

                const ctx = createMockContext({ name: KEY }, { id: 'user1', username: 'alice' });
                const response = await imageHandlers.getImage(ctx);

                expect(response.status).toBe(404);
                expect(await response.json()).toEqual({ error: 'Image not found' });
            });
        });
    });
});
