import { expect, it, vi } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { Recipe, User } from '@tandra/types';

import type { RecipeRepository } from '../RecipeRepository';
import { RecipeService } from './index';

it('logs a failed recipe by id without recipe text echoed by the persistence error', async () => {
    const title = 'private-saffron-recipe';
    const ingredient = 'private-cardamom-ingredient';
    const instruction = 'private-simmer-instruction';
    const owner: User = { id: 'user-119', username: 'owner' };
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const persistenceError = Object.assign(new Error(`Write rejected for ${title}`), {
        name: 'MongoServerError',
        code: 121,
        errInfo: { document: null as Recipe | null },
        cause: new Error(`Validation failed: ${ingredient}; ${instruction}`),
    });

    const repository = {
        getById: async (): Promise<Recipe | null> => null,
        insert: async (recipe: Recipe): Promise<Recipe> => {
            persistenceError.errInfo.document = recipe;
            throw persistenceError;
        },
    };

    const objectEraser = { listKeys: async (): Promise<string[]> => [], removeKeys: async () => {} };

    const service = new RecipeService(
        repository as unknown as RecipeRepository,
        { generate: () => 'ingredient-119' },
        objectEraser,
        logger as unknown as Logger
    );

    await expect(
        service.createRecipe(
            title,
            [{ id: 'ingredient-119', name: ingredient, quantity: 1, unit: 'kg' }],
            owner.id,
            owner,
            undefined,
            [instruction],
            undefined,
            'recipe-119'
        )
    ).rejects.toBe(persistenceError);

    expect(logger.error).toHaveBeenCalledTimes(1);

    const logged = JSON.stringify(
        Object.values(logger).flatMap((sink) => sink.mock.calls),
        (_key, value) =>
            value instanceof Error ? { ...value, name: value.name, message: value.message, stack: value.stack } : value
    );

    for (const text of [title, ingredient, instruction]) {
        expect(logged).not.toContain(text);
    }
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ recipeId: 'recipe-119' }));
});
