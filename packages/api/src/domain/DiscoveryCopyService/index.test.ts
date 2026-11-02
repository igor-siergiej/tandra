import { describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';

import type { DiscoveryRecipe, Recipe, User } from '@tandra/types';

import { RecipeService } from '../RecipeService';
import { DiscoveryCopyService } from './index';

const me: User = { id: 'u-me', username: 'me' };
const friend: User = { id: 'u-friend', username: 'friend' };

const library: DiscoveryRecipe = {
    id: 'wikibooks-1',
    title: 'Fairy Cakes',
    ingredients: [{ id: 'lib-ing-1', name: 'butter', quantity: 100, unit: 'g' }],
    instructions: ['Cream the butter.', 'Bake.'],
    tags: ['cake'],
    prepTime: 15,
    cookTime: 20,
    servings: 12,
    difficulty: 'easy',
    coverImageKey: 'library-owned-cover.png',
    source: 'wikibooks',
    sourceUrl: 'https://en.wikibooks.org/wiki/Cookbook:Fairy_Cakes',
    licence: 'CC-BY-SA-4.0',
    attribution: '"Fairy Cakes" from Wikibooks Cookbook, CC BY-SA 4.0',
    coverImageAttribution: 'Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons',
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const setup = (existing: Recipe[] = []) => {
    const store = new Map(existing.map((recipe) => [recipe.id, recipe]));

    const repo = {
        insert: async (recipe: Recipe) => {
            store.set(recipe.id, recipe);

            return recipe;
        },
        getById: async (id: string) => store.get(id) ?? null,
        update: async (id: string, recipe: Recipe) => {
            store.set(id, recipe);

            return recipe;
        },
        findByUserId: async (userId: string) =>
            [...store.values()].filter((recipe) => recipe.users.some((user) => user.id === userId)),
    };

    let n = 0;

    // The real RecipeService, with a friend list that would auto-share a recipe if the copy did not opt out.
    const recipes = new RecipeService(
        repo as never,
        { generate: () => `gen-${++n}` },
        undefined,
        undefined,
        undefined,
        undefined,
        { listFriends: async () => [friend] } as never
    );

    const discovery = {
        getRecipe: async (id: string) => {
            if (id !== library.id) throw Object.assign(new Error('Library recipe not found'), { status: 404 });

            return library;
        },
    };

    // An in-memory object store holding the library recipe's cover.
    const objects = new Map<string, { buffer: Buffer; contentType: string }>([
        ['library-owned-cover.png', { buffer: Buffer.from('cover-bytes'), contentType: 'image/png' }],
    ]);

    const images = {
        getHeadObject: async (name: string) => {
            const object = objects.get(name);

            if (!object) throw new Error('not found');

            return { metaData: { 'content-type': object.contentType } };
        },
        getObjectStream: async (name: string) => {
            const object = objects.get(name);

            if (!object) throw new Error('not found');

            return Readable.from([object.buffer]);
        },
        putObject: async (name: string, buffer: Buffer, options?: { contentType: string }) => {
            objects.set(name, { buffer, contentType: options?.contentType ?? 'application/octet-stream' });
        },
    };

    return { copy: new DiscoveryCopyService(discovery, recipes, images, undefined), store, objects };
};

describe('DiscoveryCopyService', () => {
    it('creates a personal recipe from the library recipe, keeping the source link and attribution', async () => {
        const { copy, store } = setup();

        const created = await copy.copyToPersonal('wikibooks-1', me);

        expect(store.get(created.id)).toMatchObject({
            title: 'Fairy Cakes',
            ownerId: 'u-me',
            link: library.sourceUrl,
            attribution: `${library.attribution} Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons.`,
            instructions: library.instructions,
            tags: ['cake'],
            prepTime: 15,
            cookTime: 20,
            servings: 12,
            difficulty: 'easy',
        });
        expect(created.ingredients).toEqual([{ id: expect.any(String), name: 'butter', quantity: 100, unit: 'g' }]);
    });

    it('is not shared with anyone, even though the user has friends', async () => {
        const { copy } = setup();
        const created = await copy.copyToPersonal('wikibooks-1', me);
        expect(created.users).toEqual([me]);
    });

    it("copies the library cover to the user's own key instead of pointing at the library's", async () => {
        const { copy, objects } = setup();

        const created = await copy.copyToPersonal('wikibooks-1', me);

        expect(created.coverImageKey).toMatch(/^recipe-upload\/u-me\/.+\.png$/);
        expect(created.coverImageKey).not.toBe('library-owned-cover.png');
        expect(objects.get(created.coverImageKey as string)?.buffer.toString()).toBe('cover-bytes');
    });

    it("carries the cover picture's credit into the copy's attribution, along with the recipe's own", async () => {
        const { copy } = setup();

        const created = await copy.copyToPersonal('wikibooks-1', me);

        expect(created.attribution).toBe(
            '"Fairy Cakes" from Wikibooks Cookbook, CC BY-SA 4.0 Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons.'
        );
    });

    it('does not credit a photo the copy ended up without', async () => {
        const { copy, objects } = setup();
        objects.delete('library-owned-cover.png');

        const created = await copy.copyToPersonal('wikibooks-1', me);

        expect(created.attribution).toBe('"Fairy Cakes" from Wikibooks Cookbook, CC BY-SA 4.0');
    });

    it('still creates the recipe, without a cover, when the library cover cannot be read', async () => {
        const { copy, objects, store } = setup();
        objects.delete('library-owned-cover.png');

        const created = await copy.copyToPersonal('wikibooks-1', me);

        expect(store.has(created.id)).toBe(true);
        expect(created.coverImageKey).toBeUndefined();
    });

    it('does not reuse the library ingredient ids', async () => {
        const { copy } = setup();
        const created = await copy.copyToPersonal('wikibooks-1', me);
        expect(created.ingredients[0]?.id).not.toBe('lib-ing-1');
    });

    it('answers 409 instead of creating a second copy of the same library recipe', async () => {
        const { copy, store } = setup();
        await copy.copyToPersonal('wikibooks-1', me);

        await expect(copy.copyToPersonal('wikibooks-1', me)).rejects.toMatchObject({ status: 409 });
        expect(store.size).toBe(1);
    });

    it('lets a different user make their own copy of a recipe someone else already added', async () => {
        const { copy, store } = setup();
        await copy.copyToPersonal('wikibooks-1', me);

        await copy.copyToPersonal('wikibooks-1', friend);

        expect(store.size).toBe(2);
    });

    it('passes a missing library recipe through as 404 and creates nothing', async () => {
        const { copy, store } = setup();
        await expect(copy.copyToPersonal('nope', me)).rejects.toMatchObject({ status: 404 });
        expect(store.size).toBe(0);
    });
});
