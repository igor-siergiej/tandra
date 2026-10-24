import { describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';
import type { DiscoveryRecipe, Recipe, User } from '@tandra/types';

import type { DiscoveryPublication } from '../DiscoveryPublicationRepository';
import type { DiscoveryRecipeRepository } from '../DiscoveryRecipeRepository';
import { DiscoveryService } from '../DiscoveryService';
import type { DiscoveryIndex } from '../DiscoveryService/types';
import { RecipeService } from '../RecipeService';
import { DiscoveryPublishService } from './index';

const owner: User = { id: 'u-owner', username: 'owner-name' };
const friend: User = { id: 'u-friend', username: 'friend-name' };
const other: User = { id: 'u-other', username: 'other-name' };

const RECIPE_ID = 'personal-recipe-123';

const personal = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: RECIPE_ID,
    title: 'Grandma Soup',
    ingredients: [
        { id: 'p1', name: 'Carrot', quantity: 2, unit: 'pcs' },
        { id: 'p2', name: 'onion' },
    ],
    instructions: ['Chop.', 'Simmer.'],
    tags: ['soup'],
    prepTime: 10,
    cookTime: 30,
    servings: 4,
    difficulty: 'easy',
    ownerId: owner.id,
    // The recipe is shared with a friend; none of that may reach the public copy.
    users: [owner, friend],
    dateAdded: new Date(0),
    ...overrides,
});

const setup = (initial: Recipe[] = [personal()], seedLibrary: DiscoveryRecipe[] = []) => {
    const recipes = new Map(initial.map((recipe) => [recipe.id, recipe]));
    const recipeRepo = {
        getById: async (id: string) => recipes.get(id) ?? null,
        update: async (id: string, recipe: Recipe) => {
            recipes.set(id, recipe);
            return recipe;
        },
        deleteById: async (id: string) => {
            recipes.delete(id);
        },
    };

    const library = new Map(seedLibrary.map((recipe) => [recipe.id, recipe]));
    const libraryRepo: DiscoveryRecipeRepository = {
        ensureIndexes: async () => {},
        getById: async (id) => library.get(id) ?? null,
        upsert: async (recipe) => {
            library.set(recipe.id, recipe);
        },
        deleteById: async (id) => {
            library.delete(id);
        },
        findByTitle: async (title) =>
            [...library.values()].filter((recipe) => recipe.title.toLowerCase() === title.toLowerCase()),
        hasCoverImageKey: async (key) => [...library.values()].some((recipe) => recipe.coverImageKey === key),
        hasSlug: async (slug) => [...library.values()].some((recipe) => recipe.slug === slug),
        listRevisions: async () => [],
        batches: async function* () {},
    };
    const indexed = new Map<string, DiscoveryRecipe>();
    const failIndex = { once: false };
    const index: DiscoveryIndex = {
        ensureIndex: async () => {},
        index: async (recipe) => {
            if (failIndex.once) {
                failIndex.once = false;
                throw Object.assign(new Error('Recipe discovery is temporarily unavailable'), { status: 503 });
            }
            indexed.set(recipe.id, recipe);
        },
        remove: async (id) => {
            indexed.delete(id);
        },
        search: async () => {
            throw new Error('unused');
        },
        similar: async () => [],
        rebuild: async () => 0,
    };
    const discovery = new DiscoveryService(libraryRepo, index);

    const publicationRows = new Map<string, DiscoveryPublication>();
    const publications = {
        ensureIndexes: async () => {},
        getByRecipeId: async (id: string) => publicationRows.get(id) ?? null,
        getByLibraryId: async (id: string) => [...publicationRows.values()].find((row) => row.libraryId === id) ?? null,
        listPublishedByOwner: async (ownerId: string) =>
            [...publicationRows.values()].filter((row) => row.ownerId === ownerId && row.publishedAt),
        upsert: async (row: DiscoveryPublication) => {
            publicationRows.set(row.recipeId, row);
        },
        deleteByLibraryId: async (id: string) => {
            for (const [key, row] of publicationRows) if (row.libraryId === id) publicationRows.delete(key);
        },
    };

    const objects = new Map<string, { buffer: Buffer; contentType: string }>();
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

    let n = 0;
    const ids = { generate: () => `id-${++n}` };
    const recipeService = new RecipeService(recipeRepo as never, ids);
    const publish = new DiscoveryPublishService(discovery, publications, recipeService, images, ids);
    return { publish, recipes, recipeService, library, indexed, publicationRows, objects, failIndex, discovery };
};

const agree = { agreeToLicence: true };

describe('DiscoveryPublishService.publish', () => {
    it('writes a snapshot to the library and the index, under CC BY-SA 4.0', async () => {
        const { publish, library, indexed } = setup();

        const ref = await publish.publish(RECIPE_ID, owner, agree);

        const doc = library.get(ref.libraryId);
        expect(doc).toMatchObject({
            title: 'Grandma Soup',
            source: 'user',
            licence: 'CC-BY-SA-4.0',
            instructions: ['Chop.', 'Simmer.'],
            tags: ['soup'],
            prepTime: 10,
            cookTime: 30,
            servings: 4,
            difficulty: 'easy',
            sourceUrl: `/discover/${ref.libraryId}`,
            slug: 'grandma-soup',
        });
        expect(doc?.ingredients.map((i) => i.name)).toEqual(['Carrot', 'onion']);
        expect(indexed.get(ref.libraryId)).toEqual(doc as DiscoveryRecipe);
        expect(ref.libraryId).toMatch(/^user-/);
    });

    it('appends a numeric suffix to the slug when a same-titled recipe already exists', async () => {
        const { publish, library } = setup();
        library.set('user-existing', {
            id: 'user-existing',
            title: 'Grandma Soup',
            ingredients: [{ id: 'x', name: 'pasta' }],
            instructions: ['different'],
            tags: [],
            source: 'user',
            sourceUrl: 'https://example.test/discover/user-existing',
            licence: 'CC-BY-SA-4.0',
            attribution: 'someone else',
            createdAt: new Date(0),
            updatedAt: new Date(0),
            slug: 'grandma-soup',
        });
        const ref = await publish.publish(RECIPE_ID, owner, agree);
        expect(library.get(ref.libraryId)?.slug).toBe('grandma-soup-2');
    });

    it('never takes a Wikibooks-shaped slug, even for a page not in the library yet', async () => {
        // Wikibooks recipes use their id as slug; handing this one out would block that page from ever being saved.
        const { publish, library } = setup([personal({ title: 'Wikibooks 4241' })]);
        const ref = await publish.publish(RECIPE_ID, owner, agree);
        expect(library.get(ref.libraryId)?.slug).toBe('wikibooks-4241-2');
    });

    it("exposes nothing of the private recipe: not its users, owner, ids or the author's name", async () => {
        const { publish, library, indexed } = setup();

        const ref = await publish.publish(RECIPE_ID, owner, agree);

        const everything = JSON.stringify([library.get(ref.libraryId), indexed.get(ref.libraryId)]);
        for (const secret of ['ownerId', '"users"', RECIPE_ID, owner.id, friend.id, owner.username, friend.username]) {
            expect(everything).not.toContain(secret);
        }
        expect(library.get(ref.libraryId)?.publishedBy).toBeUndefined();
        expect(library.get(ref.libraryId)?.attribution).toBe('"Grandma Soup" by a Tandra user, CC BY-SA 4.0');
        // New ingredient ids too: nothing links the copy back to the private ingredients.
        expect(library.get(ref.libraryId)?.ingredients.map((i) => i.id)).not.toContain('p1');
    });

    it("shows the author's name only when they opt in", async () => {
        const { publish, library } = setup();

        const ref = await publish.publish(RECIPE_ID, owner, { agreeToLicence: true, showName: true });

        expect(library.get(ref.libraryId)).toMatchObject({
            publishedBy: 'owner-name',
            attribution: '"Grandma Soup" by owner-name, CC BY-SA 4.0',
        });
    });

    it.each([[{}], [{ agreeToLicence: false }], [{ agreeToLicence: 'yes' as unknown as boolean }]])(
        'refuses without the explicit licence agreement (%j) and stores nothing',
        async (request) => {
            const { publish, library, publicationRows } = setup();

            await expect(publish.publish(RECIPE_ID, owner, request)).rejects.toMatchObject({ status: 400 });

            expect(library.size).toBe(0);
            expect(publicationRows.size).toBe(0);
        }
    );

    it('is owner only: a friend the recipe is shared with, and a stranger, cannot publish it', async () => {
        const { publish, library } = setup();

        await expect(publish.publish(RECIPE_ID, friend, agree)).rejects.toMatchObject({ status: 403 });
        await expect(publish.publish(RECIPE_ID, other, agree)).rejects.toMatchObject({ status: 403 });
        await expect(publish.publish('missing', owner, agree)).rejects.toMatchObject({ status: 404 });
        expect(library.size).toBe(0);
    });

    it.each([
        ['imported from a link', { link: 'https://example.com/soup' }],
        ['copied from Discover', { attribution: '"Soup" from Wikibooks Cookbook, CC BY-SA 4.0' }],
    ])("refuses a recipe %s: it holds somebody else's text", async (_label, overrides) => {
        const { publish, library } = setup([personal(overrides)]);

        await expect(publish.publish(RECIPE_ID, owner, agree)).rejects.toMatchObject({
            status: 422,
            message: expect.stringContaining("can't be made public"),
        });
        expect(library.size).toBe(0);
    });

    it('refuses a recipe with no ingredients or no instructions', async () => {
        const { publish } = setup([personal({ instructions: [] })]);
        await expect(publish.publish(RECIPE_ID, owner, agree)).rejects.toMatchObject({ status: 422 });

        const { publish: noIngredients } = setup([personal({ ingredients: [] })]);
        await expect(noIngredients.publish(RECIPE_ID, owner, agree)).rejects.toMatchObject({ status: 422 });
    });

    describe('duplicates', () => {
        const existing = (overrides: Partial<DiscoveryRecipe> = {}): DiscoveryRecipe => ({
            id: 'wikibooks-9',
            title: 'grandma soup',
            ingredients: [
                { id: 'x1', name: 'ONION' },
                { id: 'x2', name: ' carrot ', quantity: 5, unit: 'kg' },
            ],
            instructions: ['x'],
            tags: [],
            source: 'wikibooks',
            sourceUrl: 'x',
            licence: 'CC-BY-SA-4.0',
            attribution: 'x',
            createdAt: new Date(0),
            updatedAt: new Date(0),
            ...overrides,
        });

        it('refuses a recipe whose normalised title and ingredient set already exist in the library', async () => {
            const { publish, library } = setup([personal()], [existing()]);

            await expect(publish.publish(RECIPE_ID, owner, agree)).rejects.toMatchObject({
                status: 409,
                message: 'A recipe like this is already in the library',
            });
            expect(library.size).toBe(1);
        });

        it('allows the same title with a different ingredient set, and a different title with the same ingredients', async () => {
            const { publish: differentIngredients } = setup(
                [personal()],
                [existing({ ingredients: [{ id: 'x1', name: 'onion' }] })]
            );
            await expect(differentIngredients.publish(RECIPE_ID, owner, agree)).resolves.toBeDefined();

            const { publish: differentTitle } = setup([personal()], [existing({ title: 'Winter Soup' })]);
            await expect(differentTitle.publish(RECIPE_ID, owner, agree)).resolves.toBeDefined();
        });

        it("does not count the recipe's own earlier publication as a duplicate when republishing", async () => {
            const { publish } = setup();
            await publish.publish(RECIPE_ID, owner, agree);

            await expect(publish.publish(RECIPE_ID, owner, agree)).resolves.toBeDefined();
        });
    });

    it('republishing updates the same library recipe instead of adding another', async () => {
        const { publish, library, recipes } = setup();
        const first = await publish.publish(RECIPE_ID, owner, agree);
        recipes.set(RECIPE_ID, { ...(recipes.get(RECIPE_ID) as Recipe), title: 'Better Soup' });

        const second = await publish.publish(RECIPE_ID, owner, agree);

        expect(second.libraryId).toBe(first.libraryId);
        expect(library.size).toBe(1);
        expect(library.get(first.libraryId)?.title).toBe('Better Soup');
    });

    it('does not change the public copy when the personal recipe is edited later', async () => {
        const { publish, library, recipes } = setup();
        const ref = await publish.publish(RECIPE_ID, owner, agree);

        recipes.set(RECIPE_ID, {
            ...(recipes.get(RECIPE_ID) as Recipe),
            title: 'Edited privately',
            instructions: ['Secret step.'],
        });

        expect(library.get(ref.libraryId)).toMatchObject({ title: 'Grandma Soup', instructions: ['Chop.', 'Simmer.'] });
    });

    it('retries a half-finished publish onto the same library id, leaving no orphan', async () => {
        const { publish, library, failIndex, publicationRows } = setup();
        failIndex.once = true;

        await expect(publish.publish(RECIPE_ID, owner, agree)).rejects.toMatchObject({ status: 503 });
        // Mongo took the write, the index did not, and the row is not yet "published".
        expect(library.size).toBe(1);
        expect(await publish.listMine(owner)).toEqual([]);
        const firstId = publicationRows.get(RECIPE_ID)?.libraryId;

        const ref = await publish.publish(RECIPE_ID, owner, agree);

        expect(ref.libraryId).toBe(firstId as string);
        expect(library.size).toBe(1);
        expect(await publish.listMine(owner)).toHaveLength(1);
    });

    describe('cover image', () => {
        const withCover = () => {
            const world = setup([personal({ coverImageKey: 'recipe-upload/u-owner/personal-recipe-123/1.png' })]);
            world.objects.set('recipe-upload/u-owner/personal-recipe-123/1.png', {
                buffer: Buffer.from('cover-bytes'),
                contentType: 'image/png',
            });
            return world;
        };

        it('is copied to a key of its own that does not reveal the owner or the private recipe', async () => {
            const { publish, library, objects } = withCover();

            const ref = await publish.publish(RECIPE_ID, owner, agree);

            const key = library.get(ref.libraryId)?.coverImageKey as string;
            expect(key).toMatch(new RegExp(`^discovery-image/${ref.libraryId}/\\d+\\.png$`));
            expect(key).not.toContain(owner.id);
            expect(key).not.toContain(RECIPE_ID);
            expect(objects.get(key)?.buffer.toString()).toBe('cover-bytes');
        });

        it('keeps working after the private cover is replaced, removed or the recipe deleted', async () => {
            const { publish, library, objects, recipeService } = withCover();
            const ref = await publish.publish(RECIPE_ID, owner, agree);
            const key = library.get(ref.libraryId)?.coverImageKey as string;

            objects.delete('recipe-upload/u-owner/personal-recipe-123/1.png');
            await recipeService.setCoverImageKey(
                RECIPE_ID,
                'recipe-upload/u-owner/personal-recipe-123/2.png',
                owner.id
            );
            await recipeService.deleteRecipe(RECIPE_ID, owner.id);

            expect(objects.get(key)?.buffer.toString()).toBe('cover-bytes');
            expect(library.get(ref.libraryId)?.coverImageKey).toBe(key);
        });

        it('publishes without a cover, rather than failing, when the private cover cannot be read', async () => {
            const { publish, library, objects } = withCover();
            objects.clear();

            const ref = await publish.publish(RECIPE_ID, owner, agree);

            expect(library.get(ref.libraryId)).toBeDefined();
            expect(library.get(ref.libraryId)?.coverImageKey).toBeUndefined();
        });
    });
});

describe('DiscoveryPublishService.unpublish', () => {
    it('removes the library recipe, its index entry and its publication, and leaves the personal recipe alone', async () => {
        const { publish, library, indexed, publicationRows, recipes } = setup();
        const ref = await publish.publish(RECIPE_ID, owner, agree);

        await publish.unpublish(ref.libraryId, owner);

        expect(library.size).toBe(0);
        expect(indexed.size).toBe(0);
        expect(publicationRows.size).toBe(0);
        expect(recipes.get(RECIPE_ID)).toMatchObject({ title: 'Grandma Soup', users: [owner, friend] });
        expect(await publish.listMine(owner)).toEqual([]);
    });

    it('only the publisher can unpublish: anyone else, and an unknown id, get a 404 that reveals nothing', async () => {
        const { publish, library } = setup();
        const ref = await publish.publish(RECIPE_ID, owner, agree);

        await expect(publish.unpublish(ref.libraryId, other)).rejects.toMatchObject({ status: 404 });
        await expect(publish.unpublish(ref.libraryId, friend)).rejects.toMatchObject({ status: 404 });
        await expect(publish.unpublish('user-nope', owner)).rejects.toMatchObject({ status: 404 });
        expect(library.size).toBe(1);
    });

    it('keeps the public copy when the personal recipe is deleted, and the publisher can still unpublish it', async () => {
        const { publish, library, indexed, recipeService } = setup();
        const ref = await publish.publish(RECIPE_ID, owner, agree);

        await recipeService.deleteRecipe(RECIPE_ID, owner.id);

        expect(library.has(ref.libraryId)).toBe(true);
        expect(indexed.has(ref.libraryId)).toBe(true);
        expect(await publish.listMine(owner)).toEqual([expect.objectContaining({ libraryId: ref.libraryId })]);

        await publish.unpublish(ref.libraryId, owner);
        expect(library.size).toBe(0);
    });

    it('can be repeated after a failure part-way, because the publication row goes last', async () => {
        const { publish, library, discovery } = setup();
        const ref = await publish.publish(RECIPE_ID, owner, agree);
        const realRemove = discovery.remove.bind(discovery);
        let fail = true;
        discovery.remove = async (id: string) => {
            await realRemove(id);
            if (fail) {
                fail = false;
                throw Object.assign(new Error('index down'), { status: 503 });
            }
        };

        await expect(publish.unpublish(ref.libraryId, owner)).rejects.toMatchObject({ status: 503 });
        expect(await publish.listMine(owner)).toHaveLength(1);

        await publish.unpublish(ref.libraryId, owner);
        expect(library.size).toBe(0);
        expect(await publish.listMine(owner)).toEqual([]);
    });
});

describe('DiscoveryPublishService.listMine', () => {
    it("lists only the caller's finished publications", async () => {
        const { publish } = setup([
            personal(),
            personal({ id: 'r2', title: 'Other Soup', ownerId: other.id, users: [other] }),
        ]);
        const mine = await publish.publish(RECIPE_ID, owner, agree);
        await publish.publish('r2', other, agree);

        expect(await publish.listMine(owner)).toEqual([
            { recipeId: RECIPE_ID, libraryId: mine.libraryId, publishedAt: expect.any(Date) },
        ]);
    });
});
