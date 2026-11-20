import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { Hono } from 'hono';

const mockDependencyContainer = { resolve: vi.fn() };

vi.mock('../../dependencies', () => ({ dependencyContainer: mockDependencyContainer }));

import { receiveLogs } from './index';

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const app = new Hono().post('/logs', receiveLogs);

const postLog = (context: Record<string, unknown>) =>
    app.request('/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.119' },
        body: JSON.stringify({ level: 'error', message: 'Recipe request failed', context }),
    });

const loggedText = () => JSON.stringify(Object.values(logger).flatMap((sink) => sink.mock.calls));

describe('LogHandlers context boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockReturnValue(logger);
    });

    it('drops unrecognised context keys even when their names do not identify user content', async () => {
        const context = {
            userId: 'user-119',
            listId: 'list-119',
            itemId: 'item-119',
            recipeId: 'recipe-119',
            route: '/recipes/:recipeId',
            errorName: 'TypeError',
            errorMessage: 'Network request failed',
            details: 'private-tamarind-item',
            diagnostic: 'private-saffron-recipe',
            attempt: 2,
        };

        const response = await postLog(context);

        expect(response.status).toBe(204);
        expect(logger.error).toHaveBeenCalledTimes(1);
        const [, logged] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
        expect(logged).toEqual(
            expect.objectContaining({
                userId: context.userId,
                listId: context.listId,
                itemId: context.itemId,
                recipeId: context.recipeId,
                route: context.route,
                errorName: context.errorName,
                errorMessage: context.errorMessage,
            })
        );
        expect(logged).not.toHaveProperty('details');
        expect(logged).not.toHaveProperty('diagnostic');
        expect(logged).not.toHaveProperty('attempt');
        expect(loggedText()).not.toContain(context.details);
        expect(loggedText()).not.toContain(context.diagnostic);
    });

    it('keeps item names, recipe text and voice transcripts out of a structured error context', async () => {
        const userContent = {
            listTitle: 'private-household-menu',
            itemName: 'private-tamarind-item',
            recipeTitle: 'private-saffron-recipe',
            ingredients: ['private-cardamom-ingredient'],
            instructions: ['private-simmer-instruction'],
            transcript: 'private-voice-add-tamarind',
        };

        const response = await postLog({
            recipeId: 'recipe-119',
            route: '/recipes/:recipeId',
            error: { name: 'TypeError', message: 'Request failed', request: userContent },
        });

        expect(response.status).toBe(204);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ recipeId: 'recipe-119', route: '/recipes/:recipeId' })
        );

        for (const text of Object.values(userContent).flat()) {
            expect(loggedText()).not.toContain(text);
        }
    });
});
