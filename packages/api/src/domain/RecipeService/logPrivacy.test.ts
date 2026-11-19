import { beforeEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { Ingredient, Recipe, User } from '@tandra/types';

import { RecipeService } from './index';

// The privacy notice promises logs hold no recipe text: titles, ingredients and instructions must never be logged.
const TITLE = 'Quokkafest Stew Title';
const NEW_TITLE = 'Quokkafest Renamed Title';
const INGREDIENT = 'Dragonfruit Ingredient Name';
const INSTRUCTION = 'Simmer the quokkafest instruction for an hour';
const SENTINELS = ['quokkafest', 'dragonfruit'];

const owner: User = { id: 'user-1', username: 'alice' };
const friend: User = { id: 'user-2', username: 'bob' };
const ingredients: Ingredient[] = [{ id: 'ing-1', name: INGREDIENT, quantity: 1, unit: 'kg' }];

const calls: Array<{ level: string; args: unknown[] }> = [];

const logger = {
    info: (...args: unknown[]) => calls.push({ level: 'info', args }),
    warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
    error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    debug: (...args: unknown[]) => calls.push({ level: 'debug', args }),
} as unknown as Logger;

const loggedText = (): string =>
    JSON.stringify(calls, (_key, value) =>
        value instanceof Error ? { name: value.name, message: value.message } : value
    ).toLowerCase();

const expectNoRecipeText = () => {
    for (const sentinel of SENTINELS) {
        expect(loggedText()).not.toContain(sentinel);
    }
};

class MemoryRecipes {
    store = new Map<string, Recipe>();
    failInsert = false;

    async insert(recipe: Recipe) {
        if (this.failInsert) throw new Error('database down');
        this.store.set(recipe.id, recipe);

        return recipe;
    }
    async getById(id: string) {
        return this.store.get(id) ?? null;
    }
    async update(id: string, recipe: Recipe) {
        this.store.set(id, recipe);

        return recipe;
    }
    async deleteById(id: string) {
        this.store.delete(id);
    }
    async addTags() {}
}

describe('RecipeService logging', () => {
    let recipes: MemoryRecipes;
    let tagger: { generateTags: () => Promise<string[]> };
    let substituter: { generateSubstitutes: () => Promise<string[]> };
    let service: RecipeService;

    beforeEach(() => {
        calls.length = 0;
        recipes = new MemoryRecipes();
        tagger = { generateTags: async () => ['dinner'] };
        substituter = { generateSubstitutes: async () => ['honey'] };

        service = new RecipeService(
            recipes as never,
            { generate: () => 'generated-id' },
            logger,
            undefined,
            undefined,
            { areFriends: async () => true, listFriends: async () => [friend] } as never,
            tagger,
            substituter
        );
    });

    it('should log no recipe text when a recipe is created', async () => {
        await service.createRecipe(
            TITLE,
            ingredients,
            owner.id,
            owner,
            undefined,
            [INSTRUCTION],
            undefined,
            'recipe-1'
        );

        expect(calls.length).toBeGreaterThan(0);
        expect(loggedText()).toContain('recipe-1');
        expectNoRecipeText();
    });

    it('should log no recipe text when a recipe is shared with chosen friends on creation', async () => {
        await service.createRecipe(
            TITLE,
            ingredients,
            owner.id,
            owner,
            undefined,
            [INSTRUCTION],
            [friend.id],
            'recipe-1'
        );

        expectNoRecipeText();
    });

    it('should log no recipe text when creating a recipe fails', async () => {
        recipes.failInsert = true;

        await expect(
            service.createRecipe(TITLE, ingredients, owner.id, owner, undefined, [INSTRUCTION], undefined, 'recipe-1')
        ).rejects.toThrow('database down');

        expect(calls.some((c) => c.level === 'error')).toBe(true);
        expectNoRecipeText();
    });

    it('should log no recipe text when AI tagging fails in the background', async () => {
        tagger.generateTags = async () => {
            throw new Error('tagger down');
        };

        await service.createRecipe(
            TITLE,
            ingredients,
            owner.id,
            owner,
            undefined,
            [INSTRUCTION],
            undefined,
            'recipe-1'
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(calls.some((c) => c.level === 'warn')).toBe(true);
        expectNoRecipeText();
    });

    it('should log no recipe text when a recipe is updated', async () => {
        await service.createRecipe('Plain', [], owner.id, owner, undefined, undefined, undefined, 'recipe-1');
        calls.length = 0;

        await service.updateRecipe('recipe-1', NEW_TITLE, ingredients, owner.id, undefined, [INSTRUCTION]);

        expect(loggedText()).toContain('recipe-1');
        expectNoRecipeText();
    });

    it('should log no recipe text when updating a recipe fails', async () => {
        await service.createRecipe('Plain', [], owner.id, owner, undefined, undefined, undefined, 'recipe-1');
        calls.length = 0;

        await expect(
            service.updateRecipe('recipe-1', NEW_TITLE, ingredients, 'someone-else', undefined, [INSTRUCTION])
        ).rejects.toThrow();

        expect(calls.some((c) => c.level === 'error')).toBe(true);
        expectNoRecipeText();
    });

    it('should log no recipe text when a recipe is deleted', async () => {
        await service.createRecipe(
            TITLE,
            ingredients,
            owner.id,
            owner,
            undefined,
            [INSTRUCTION],
            undefined,
            'recipe-1'
        );
        calls.length = 0;

        await service.deleteRecipe('recipe-1', owner.id);

        expect(loggedText()).toContain('recipe-1');
        expectNoRecipeText();
    });

    it('should log no ingredient or recipe title when a substitute lookup fails', async () => {
        substituter.generateSubstitutes = async () => {
            throw new Error('substituter down');
        };

        await expect(service.suggestSubstitutes(INGREDIENT, TITLE)).rejects.toThrow();

        expect(calls.some((c) => c.level === 'warn')).toBe(true);
        expectNoRecipeText();
    });
});
