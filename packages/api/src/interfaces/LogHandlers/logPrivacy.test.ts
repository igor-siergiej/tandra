import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { Context } from 'hono';

import { IpRateLimiter } from '../../infrastructure/rateLimit';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies', () => ({
    dependencyContainer: mockDependencyContainer,
}));

vi.spyOn(IpRateLimiter.prototype, 'isAllowed').mockReturnValue(true);

import { receiveLogs } from './index';

// The privacy notice promises front-end logs hold "userId, userAgent, URL and server-observed clientIp. No list-item
// text, recipe text or transcripts." The client's free-form `context` must therefore be filtered, not spread.
const ITEM_NAME = 'dragonfruit-item-name';
const LIST_TITLE = 'quokkafest-list-title';
const RECIPE_TITLE = 'quokkafest-recipe-title';
const INGREDIENT = 'dragonfruit-ingredient';
const INSTRUCTION = 'simmer the quokkafest instruction';
const TRANSCRIPT = 'add dragonfruit and quokkafest to the list';
const SENTINELS = ['dragonfruit', 'quokkafest'];

const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

const createContext = (body: unknown) =>
    ({
        req: {
            header: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.7' : undefined),
            json: vi.fn().mockResolvedValue(body),
            raw: { headers: { get: (_name: string): null => null } },
        },
        json: (payload: unknown, status: number) =>
            new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }),
    }) as unknown as Context;

const loggedText = (): string =>
    JSON.stringify(
        [mockLogger.info, mockLogger.warn, mockLogger.error, mockLogger.debug].flatMap((fn) => fn.mock.calls),
        (_key, value) => (value instanceof Error ? { name: value.name, message: value.message } : value)
    ).toLowerCase();

const userContent = {
    itemName: ITEM_NAME,
    listTitle: LIST_TITLE,
    title: RECIPE_TITLE,
    recipeTitle: RECIPE_TITLE,
    ingredients: [INGREDIENT],
    ingredientName: INGREDIENT,
    instructions: [INSTRUCTION],
    transcript: TRANSCRIPT,
    nested: { name: ITEM_NAME },
};

describe('LogHandlers context filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockReturnValue(mockLogger);
    });

    describe('When the client sends user content in the log context', () => {
        it('should drop item names, list titles, recipe text and transcripts from the logged object', async () => {
            const response = await receiveLogs(
                createContext({ level: 'info', message: 'Something happened', context: userContent })
            );

            expect(response.status).toBe(204);
            expect(mockLogger.info).toHaveBeenCalledTimes(1);

            const [message, logged] = mockLogger.info.mock.calls[0] as [string, Record<string, unknown>];

            expect(message).toBe('Something happened');
            expect(Object.keys(userContent).filter((key) => key in logged)).toEqual([]);

            for (const sentinel of SENTINELS) {
                expect(JSON.stringify(logged).toLowerCase()).not.toContain(sentinel);
            }
        });

        it('should drop user content at every log level', async () => {
            for (const level of ['debug', 'info', 'warn', 'error'] as const) {
                await receiveLogs(createContext({ level, message: 'm', context: userContent }));
            }

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });

        it('should keep only ids, the error and the route, plus what the server observed', async () => {
            await receiveLogs(
                createContext({
                    level: 'error',
                    message: 'Failed to load recipes',
                    userAgent: 'TestAgent/1.0',
                    url: 'https://app.tandra.uk/recipes',
                    context: {
                        ...userContent,
                        userId: 'user-1',
                        listId: 'list-1',
                        itemId: 'item-1',
                        recipeId: 'recipe-1',
                        route: '/recipes/:recipeId',
                        error: 'Network request failed',
                    },
                })
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to load recipes',
                expect.objectContaining({
                    source: 'frontend',
                    clientIp: '203.0.113.7',
                    userAgent: 'TestAgent/1.0',
                    url: 'https://app.tandra.uk/recipes',
                    userId: 'user-1',
                    listId: 'list-1',
                    itemId: 'item-1',
                    recipeId: 'recipe-1',
                    route: '/recipes/:recipeId',
                    error: 'Network request failed',
                })
            );

            const [, logged] = mockLogger.error.mock.calls[0] as [string, Record<string, unknown>];

            expect(Object.keys(userContent).filter((key) => key in logged)).toEqual([]);
        });

        it('should not let the client overwrite the server-observed fields', async () => {
            await receiveLogs(
                createContext({
                    level: 'info',
                    message: 'm',
                    context: { source: 'backend', clientIp: '198.51.100.1' },
                })
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                'm',
                expect.objectContaining({ source: 'frontend', clientIp: '203.0.113.7' })
            );
        });
    });

    describe('When a rejected log carries user content', () => {
        it('should not log the context of a log with no message', async () => {
            const response = await receiveLogs(createContext({ level: 'info', context: userContent }));

            expect(response.status).toBe(400);
            expect(mockLogger.warn).toHaveBeenCalled();

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });

        it('should not log the context of a log that failed to be written', async () => {
            mockLogger.info.mockImplementationOnce(() => {
                throw new Error('sink unavailable');
            });

            const response = await receiveLogs(createContext({ level: 'info', message: 'm', context: userContent }));

            expect(response.status).toBe(500);
            expect(mockLogger.error).toHaveBeenCalled();

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });
    });
});
