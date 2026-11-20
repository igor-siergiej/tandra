import { describe, expect, it } from 'bun:test';

import type { DiscoveryRecipe, Recipe, User } from '@tandra/types';

import type { ObjectEraser } from '../AccountService';
import { DiscoveryModerationService } from '../DiscoveryModeration';
import type { DiscoveryPublication } from '../DiscoveryPublicationRepository';
import { DiscoveryPublishService } from '../DiscoveryPublish';
import { RecipeService } from './index';

const owner: User = { id: 'owner', username: 'alice' };
const admin: User = { id: 'admin', username: 'moderator' };
const recipeId = 'private-1';
const libraryId = 'user-public-1';
const canonicalKey = `recipe-image/${recipeId}.webp`;
const legacyKey = 'recipe-image/legacy-soup';
const publicKeys = [`discovery-image/${libraryId}/1.webp`, `discovery-image/${libraryId}/2.png`];

const untouchedKeys = [
    `discovery-image/${libraryId}-other/1.webp`,
    'discovery-image/wikibooks-1/cover.webp',
    'recipe-image/another-recipe.webp',
    'recipe-upload/someone-else/other/1.webp',
    'recipe-upload/owner/private-1/1.webp',
];

type Removal = 'unpublish' | 'delist' | 'deleteRecipe' | 'deleteRecipeWithoutImageReference';

const setup = (removal: Removal) => {
    const recipe: Recipe = {
        id: recipeId,
        title: 'Soup',
        ownerId: owner.id,
        users: [owner],
        dateAdded: new Date(0),
        ingredients: [{ id: 'ingredient', name: 'Carrot' }],
        instructions: ['Simmer.'],
        ...(removal !== 'deleteRecipeWithoutImageReference' && {
            aiImageKey: legacyKey,
            coverImageKey: untouchedKeys[1],
        }),
    };

    const recipes = new Map([[recipeId, recipe]]);

    const library = new Map<string, DiscoveryRecipe>([
        [
            libraryId,
            {
                id: libraryId,
                title: 'Soup',
                ingredients: [],
                instructions: [],
                tags: [],
                source: 'user',
                sourceUrl: `/discover/${libraryId}`,
                licence: 'CC-BY-SA-4.0',
                attribution: 'Alice',
                createdAt: new Date(0),
                updatedAt: new Date(0),
                coverImageKey: publicKeys[1],
            },
        ],
    ]);

    const publications = new Map<string, DiscoveryPublication>([
        [
            libraryId,
            {
                recipeId,
                libraryId,
                ownerId: owner.id,
                publishedAt: new Date(0),
            },
        ],
    ]);

    const objects = new Set([...publicKeys, canonicalKey, legacyKey, ...untouchedKeys]);
    const state = { failRemoving: false, failListing: false, failIndex: false };

    const images: ObjectEraser = {
        listKeys: async (prefix) => {
            if (state.failListing) throw new Error('object listing unavailable');

            return [...objects].filter((key) => key.startsWith(prefix));
        },
        removeKeys: async (keys) => {
            if (state.failRemoving) {
                // Partial bucket failures must be safe to repeat as well.
                objects.delete(keys[0] as string);
                throw new Error('object removal unavailable');
            }

            keys.forEach((key) => objects.delete(key));
        },
    };

    const recipeRepo = {
        getById: async (id: string) => recipes.get(id) ?? null,
        getAll: async () => [...recipes.values()],
        deleteById: async (id: string) => {
            recipes.delete(id);
        },
    };

    const publicationRepo = {
        getByLibraryId: async (id: string) => publications.get(id) ?? null,
        deleteByLibraryId: async (id: string) => {
            publications.delete(id);
        },
    };

    const discovery = {
        getRecipes: async (ids: string[]): Promise<DiscoveryRecipe[]> =>
            ids.flatMap((id) => {
                const recipe = library.get(id);

                return recipe ? [recipe] : [];
            }),
        getRecipe: async (id: string) => {
            const found = library.get(id);

            if (!found) throw Object.assign(new Error('Library recipe not found'), { status: 404 });

            return found;
        },
        remove: async (id: string) => {
            library.delete(id);

            if (state.failIndex) throw new Error('index unavailable');
        },
    };

    const ids = { generate: () => 'unused' };
    const service = new RecipeService(recipeRepo as never, ids, images);

    const publish = new DiscoveryPublishService(
        discovery as never,
        publicationRepo as never,
        service,
        {} as never,
        ids,
        images
    );

    const moderation = new DiscoveryModerationService(
        discovery,
        { deleteByRecipeId: async () => {} } as never,
        publicationRepo as never,
        ids,
        new Set([admin.id]),
        images
    );

    const remove = () =>
        removal === 'unpublish'
            ? publish.unpublish(libraryId, owner)
            : removal === 'delist'
              ? moderation.delist(libraryId, admin)
              : service.deleteRecipe(recipeId, owner.id);

    const hasOwnership = () =>
        removal.startsWith('deleteRecipe') ? recipes.has(recipeId) : publications.has(libraryId);

    const removedKeys =
        removal === 'deleteRecipe'
            ? [canonicalKey, legacyKey]
            : removal === 'deleteRecipeWithoutImageReference'
              ? [canonicalKey]
              : publicKeys;

    return { remove, hasOwnership, removedKeys, objects, state, recipes, library, publications, service };
};

const removals: Removal[] = ['unpublish', 'delist', 'deleteRecipe', 'deleteRecipeWithoutImageReference'];

describe('Image ownership removal', () => {
    it.each(removals)('%s cleans every owned image before discarding its last ownership row', async (removal) => {
        const world = setup(removal);
        world.state.failRemoving = true;

        await expect(world.remove()).rejects.toThrow('object removal unavailable');
        expect(world.hasOwnership()).toBe(true);

        world.state.failRemoving = false;
        await world.remove();

        expect(world.hasOwnership()).toBe(false);

        for (const key of world.removedKeys) expect(world.objects.has(key)).toBe(false);

        for (const key of untouchedKeys) expect(world.objects.has(key)).toBe(true);
    });

    it.each(['unpublish', 'delist'] as const)('%s retains ownership when the prefix sweep fails', async (removal) => {
        const world = setup(removal);
        world.state.failListing = true;

        await expect(world.remove()).rejects.toThrow('object listing unavailable');
        expect(world.hasOwnership()).toBe(true);

        world.state.failListing = false;
        await world.remove();
        expect(world.hasOwnership()).toBe(false);

        for (const key of publicKeys) expect(world.objects.has(key)).toBe(false);
    });

    it('delist can retry an index failure after the library row has gone', async () => {
        const world = setup('delist');
        world.state.failIndex = true;

        await expect(world.remove()).rejects.toThrow('index unavailable');
        expect(world.hasOwnership()).toBe(true);
        expect(world.library.size).toBe(0);

        world.state.failIndex = false;
        await world.remove();
        expect(world.hasOwnership()).toBe(false);
    });

    it('deleteRecipe leaves an AI key used by another recipe until its final reference is removed', async () => {
        const world = setup('deleteRecipe');

        const copied = {
            ...world.recipes.get(recipeId)!,
            id: 'copy',
            ownerId: 'other-owner',
            aiImageKey: legacyKey,
            coverImageKey: canonicalKey,
        };

        world.recipes.set(copied.id, copied);

        await world.remove();

        expect(world.objects.has(legacyKey)).toBe(true);
        expect(world.objects.has(canonicalKey)).toBe(true);
        await world.service.deleteRecipe(copied.id, copied.ownerId!);
        expect(world.objects.has(legacyKey)).toBe(false);
        expect(world.objects.has(canonicalKey)).toBe(false);

        for (const key of untouchedKeys) expect(world.objects.has(key)).toBe(true);
    });
});
