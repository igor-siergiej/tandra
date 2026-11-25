import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { Recipe } from '@tandra/types';
import type { Context } from 'hono';

import * as recipeHandlers from './index';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies/container', () => ({
    dependencyContainer: mockDependencyContainer,
}));

// The privacy notice promises logs hold no recipe text: titles, ingredients and instructions must never be logged.
const TITLE = 'Quokkafest Stew Title';
const INGREDIENT = 'Dragonfruit Ingredient Name';
const INSTRUCTION = 'Simmer the quokkafest instruction for an hour';
const SENTINELS = ['quokkafest', 'dragonfruit'];

const user = { id: 'user-1', username: 'testuser' };

const recipe: Recipe = {
    id: 'recipe-1',
    title: TITLE,
    ingredients: [{ id: 'ing-1', name: INGREDIENT }],
    instructions: [INSTRUCTION],
    ownerId: user.id,
    users: [user],
    dateAdded: new Date(),
};

const mockRecipeService = {
    getRecipe: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    suggestSubstitutes: vi.fn(),
};

const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

const loggedText = (): string =>
    JSON.stringify(
        [mockLogger.info, mockLogger.warn, mockLogger.error, mockLogger.debug].flatMap((fn) => fn.mock.calls),
        (_key, value) => (value instanceof Error ? { name: value.name, message: value.message } : value)
    ).toLowerCase();

const createContext = (params: Record<string, string>, body: unknown) =>
    ({
        req: {
            param: (name: string) => params[name],
            query: (): undefined => undefined,
            json: vi.fn().mockResolvedValue(body),
            header: (_name: string): undefined => undefined,
        },
        json: (payload: unknown, status: number) =>
            new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }),
        get: (key: string) => (key === 'user' ? user : undefined),
        set: vi.fn(),
    }) as unknown as Context<{ Variables: { user: typeof user } }>;

const recipeBody = { title: TITLE, ingredients: recipe.ingredients, instructions: [INSTRUCTION] };

const handlers: Array<{ name: string; run: () => Promise<unknown>; service: ReturnType<typeof vi.fn> }> = [
    {
        name: 'creating a recipe',
        run: () => recipeHandlers.createRecipe(createContext({}, recipeBody)),
        service: mockRecipeService.createRecipe,
    },
    {
        name: 'updating a recipe',
        run: () => recipeHandlers.updateRecipe(createContext({ recipeId: 'recipe-1' }, recipeBody)),
        service: mockRecipeService.updateRecipe,
    },
    {
        name: 'asking for ingredient substitutes',
        run: () =>
            recipeHandlers.suggestIngredientSubstitutes(
                createContext({}, { ingredientName: INGREDIENT, recipeTitle: TITLE })
            ),
        service: mockRecipeService.suggestSubstitutes,
    },
];

describe('RecipeHandlers logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockImplementation((token: string) => {
            if (token === 'RecipeService') return mockRecipeService;

            if (token === 'Logger') return mockLogger;

            return null;
        });
        mockRecipeService.getRecipe.mockResolvedValue(recipe);
        mockRecipeService.createRecipe.mockResolvedValue(recipe);
        mockRecipeService.updateRecipe.mockResolvedValue(recipe);
        mockRecipeService.suggestSubstitutes.mockResolvedValue(['honey']);
    });

    describe('When a request succeeds', () => {
        it.each(handlers)('should log no recipe text when $name', async ({ run }) => {
            await run();

            expect(mockLogger.info).toHaveBeenCalled();

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });
    });

    // Updating logs only the recipe id on failure today, so it has no failing case to pin.
    describe('When the service fails', () => {
        it.each(handlers.filter((h) => h.service !== mockRecipeService.updateRecipe))(
            'should log no recipe text when $name',
            async ({ run, service }) => {
                service.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

                await run().catch((): void => undefined);

                expect(mockLogger.error).toHaveBeenCalled();

                for (const sentinel of SENTINELS) {
                    expect(loggedText()).not.toContain(sentinel);
                }
            }
        );
    });
});
