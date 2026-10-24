import { describe, expect, it, vi } from 'bun:test';
import type { DiscoveryRecipe } from '@tandra/types';

import { MongoDiscoveryRecipeRepository } from './index';

const NO_OBJECT_ID = { projection: { _id: 0 } } as const;

const recipe = (id: string): DiscoveryRecipe => ({
    id,
    title: id,
    ingredients: [],
    instructions: [],
    tags: [],
    source: 'wikibooks',
    sourceUrl: 'https://example.test',
    licence: 'CC-BY-SA-4.0',
    attribution: 'Wikibooks contributors',
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

const setup = (docs: DiscoveryRecipe[] = []) => {
    const collection = {
        createIndex: vi.fn(),
        findOne: vi.fn(async () => docs[0] ?? null),
        replaceOne: vi.fn(),
        deleteOne: vi.fn(),
        countDocuments: vi.fn(async () => 1),
        find: vi.fn(() => ({
            toArray: async () => docs,
            sort: () =>
                (async function* () {
                    yield* docs;
                })(),
        })),
    };
    const db = { getCollection: vi.fn(() => collection) };
    return { repo: new MongoDiscoveryRecipeRepository(db as never), collection, db };
};

describe('MongoDiscoveryRecipeRepository', () => {
    it('uses the dedicated discoveryRecipes collection, not the personal recipe collection', async () => {
        const { repo, db } = setup();
        await repo.getById('a');
        expect(db.getCollection).toHaveBeenCalledWith('discoveryRecipes');
    });

    it('guarantees one document per library id', async () => {
        const { repo, collection } = setup();
        await repo.ensureIndexes();
        expect(collection.createIndex).toHaveBeenCalledWith({ id: 1 }, { unique: true });
    });

    it('never returns Mongo _id', async () => {
        const { repo, collection } = setup([recipe('a')]);
        await repo.getById('a');
        expect(collection.findOne).toHaveBeenCalledWith({ id: 'a' }, { projection: { _id: 0 } });
    });

    it('fetches several recipes in one $in query, and skips the query for no ids', async () => {
        const { repo, collection } = setup([recipe('a'), recipe('b')]);

        expect((await repo.getByIds(['a', 'b'])).map((r) => r.id)).toEqual(['a', 'b']);
        expect(collection.find).toHaveBeenCalledWith({ id: { $in: ['a', 'b'] } }, { projection: { _id: 0 } });

        collection.find.mockClear();
        expect(await repo.getByIds([])).toEqual([]);
        expect(collection.find).not.toHaveBeenCalled();
    });

    it('upserts by library id', async () => {
        const { repo, collection } = setup();
        await repo.upsert(recipe('a'));
        expect(collection.replaceOne).toHaveBeenCalledWith({ id: 'a' }, recipe('a'), { upsert: true });
    });

    it('streams the whole library in bounded batches, including the short final one', async () => {
        const { repo } = setup([recipe('a'), recipe('b'), recipe('c'), recipe('d'), recipe('e')]);
        const sizes: number[] = [];
        for await (const batch of repo.batches(2)) sizes.push(batch.length);
        expect(sizes).toEqual([2, 2, 1]);
    });

    it('yields nothing for an empty library', async () => {
        const { repo } = setup([]);
        const sizes: number[] = [];
        for await (const batch of repo.batches(2)) sizes.push(batch.length);
        expect(sizes).toEqual([]);
    });

    it('lists revisions for one source only, without loading whole recipes', async () => {
        const { repo, collection } = setup([{ ...recipe('wikibooks-1'), sourceRevision: 7 }]);
        const revisions = await repo.listRevisions('wikibooks');
        expect(collection.find).toHaveBeenCalledWith(
            { source: 'wikibooks' },
            { projection: { _id: 0, id: 1, sourceRevision: 1, imageRevision: 1, createdAt: 1 } }
        );
        expect(revisions).toHaveLength(1);
    });

    it('finds same-titled recipes case-insensitively, so a duplicate check is not fooled by capitals', async () => {
        const { repo, collection } = setup([recipe('a')]);
        await repo.findByTitle('Grandma Soup');
        expect(collection.find).toHaveBeenCalledWith(
            { title: 'Grandma Soup' },
            { projection: { _id: 0 }, collation: { locale: 'en', strength: 2 } }
        );
    });

    it('asks whether a cover key is still in use with a single-document count', async () => {
        const { repo, collection } = setup();
        expect(await repo.hasCoverImageKey('discovery-image/user-1/1.png')).toBe(true);
        expect(collection.countDocuments).toHaveBeenCalledWith(
            { coverImageKey: 'discovery-image/user-1/1.png' },
            { limit: 1 }
        );
        collection.countDocuments.mockResolvedValueOnce(0);
        expect(await repo.hasCoverImageKey('gone')).toBe(false);
    });

    it('adds a unique sparse slug index so user-published slugs cannot collide', async () => {
        const { repo, collection } = setup();
        await repo.ensureIndexes();
        expect(collection.createIndex).toHaveBeenCalledWith({ slug: 1 }, { unique: true, sparse: true });
    });

    it('looks up by slug case-sensitively and never returns _id', async () => {
        const { repo, collection } = setup();
        collection.findOne.mockResolvedValueOnce(recipe('abc'));
        const result = await repo.getBySlug('pancakes');
        expect(collection.findOne).toHaveBeenCalledWith({ slug: 'pancakes' }, NO_OBJECT_ID);
        expect(result?.id).toBe('abc');
    });

    it('listPublic returns only recipes that have a slug and sorts them newest-first', async () => {
        const { repo, collection } = setup();
        let capturedSort: unknown;
        collection.find = vi.fn().mockReturnValue({
            sort: (s: unknown) => {
                capturedSort = s;
                return { limit: () => ({ toArray: async () => [] }) };
            },
        });
        await repo.listPublic(20, null);
        expect(collection.find).toHaveBeenCalledWith({ slug: { $exists: true } }, { projection: {} });
        expect(capturedSort).toEqual({ createdAt: -1, _id: -1 });
    });

    it('listPublic seeks past the cursor with _id < after', async () => {
        const { repo, collection } = setup();
        const findCalls: unknown[][] = [];
        collection.find = vi.fn((filter: unknown) => {
            findCalls.push([filter]);
            return {
                sort: () => ({ limit: () => ({ toArray: async () => [] }) }),
            };
        });
        await repo.listPublic(20, '507f1f77bcf86cd799439011');
        const capturedFilter = findCalls[0]?.[0];
        expect(capturedFilter).toMatchObject({ slug: { $exists: true } });
        expect(JSON.stringify(capturedFilter)).toContain('507f1f77bcf86cd799439011');
    });

    it('hasSlug returns false when no recipe owns the slug', async () => {
        const { repo, collection } = setup();
        collection.countDocuments.mockResolvedValueOnce(0);
        expect(await repo.hasSlug('pancakes')).toBe(false);
    });
});

type Doc = Record<string, unknown>;
type Condition = { $ne?: unknown; $exists?: boolean; $in?: unknown[]; $nin?: unknown[]; $regex?: RegExp };

// Just the query operators the slug backfill uses, with Mongo's meaning.
const matchesCondition = (value: unknown, condition: unknown): boolean => {
    if (typeof condition !== 'object' || condition === null) return value === condition;
    const c = condition as Condition;
    return (
        (c.$ne === undefined || value !== c.$ne) &&
        (c.$exists === undefined || (value !== undefined) === c.$exists) &&
        (c.$in === undefined || c.$in.includes(value)) &&
        (c.$nin === undefined || !c.$nin.includes(value)) &&
        (c.$regex === undefined || (typeof value === 'string' && c.$regex.test(value)))
    );
};

const matches = (doc: Doc, filter: Doc): boolean =>
    Object.entries(filter).every(([field, condition]) => matchesCondition(doc[field], condition));

/**
 * In-memory `discoveryRecipes` with the unique sparse slug index: like Mongo, a multi-document update that hits a
 * duplicate slug throws and stops there.
 */
const libraryCollection = (docs: Doc[]) => ({
    distinct: vi.fn(async (field: string, filter: Doc) => [
        ...new Set(docs.filter((doc) => matches(doc, filter)).map((doc) => doc[field])),
    ]),
    updateMany: vi.fn(async (filter: Doc, pipeline: Array<{ $set: Record<string, string> }>) => {
        let modifiedCount = 0;
        for (const doc of docs.filter((candidate) => matches(candidate, filter))) {
            const next = { ...doc };
            for (const stage of pipeline) {
                for (const [field, path] of Object.entries(stage.$set)) next[field] = doc[path.replace(/^\$/, '')];
            }
            if (docs.some((other) => other !== doc && other.slug !== undefined && other.slug === next.slug)) {
                throw Object.assign(new Error('E11000 duplicate key error collection: discoveryRecipes'), {
                    code: 11000,
                });
            }
            Object.assign(doc, next);
            modifiedCount += 1;
        }
        return { modifiedCount };
    }),
});

describe('MongoDiscoveryRecipeRepository.assignWikibooksSlugs', () => {
    const doc = (id: string, source: string, slug?: string): Doc => ({ id, source, ...(slug && { slug }) });
    const setupLibrary = (docs: Doc[]) => {
        const collection = libraryCollection(docs);
        const repo = new MongoDiscoveryRecipeRepository({ getCollection: () => collection } as never);
        return { repo, collection, slugs: () => Object.fromEntries(docs.map((d) => [d.id, d.slug])) };
    };

    it('gives slugless Wikibooks recipes their id as slug and leaves every existing slug alone', async () => {
        const { repo, slugs } = setupLibrary([
            doc('wikibooks-1', 'wikibooks'),
            doc('wikibooks-2', 'wikibooks', 'hand-picked'),
            doc('user-1', 'user', 'soup'),
            doc('user-2', 'user'),
        ]);

        expect(await repo.assignWikibooksSlugs()).toEqual({ assigned: 1, blocked: [] });
        expect(slugs()).toEqual({
            'wikibooks-1': 'wikibooks-1',
            'wikibooks-2': 'hand-picked',
            'user-1': 'soup',
            'user-2': undefined,
        });
    });

    it('is idempotent: a second run assigns nothing and changes nothing', async () => {
        const { repo, slugs } = setupLibrary([doc('wikibooks-1', 'wikibooks'), doc('wikibooks-2', 'wikibooks')]);
        await repo.assignWikibooksSlugs();
        const after = slugs();

        expect(await repo.assignWikibooksSlugs()).toEqual({ assigned: 0, blocked: [] });
        expect(slugs()).toEqual(after);
    });

    it('skips a Wikibooks recipe whose id another recipe already uses as slug, and still does the rest', async () => {
        const { repo, slugs, collection } = setupLibrary([
            doc('user-1', 'user', 'wikibooks-3'),
            doc('wikibooks-3', 'wikibooks'),
            doc('wikibooks-4', 'wikibooks'),
        ]);

        expect(await repo.assignWikibooksSlugs()).toEqual({ assigned: 1, blocked: ['wikibooks-3'] });
        expect(slugs()).toEqual({ 'user-1': 'wikibooks-3', 'wikibooks-3': undefined, 'wikibooks-4': 'wikibooks-4' });
        expect(collection.updateMany).toHaveBeenCalledWith(
            { source: 'wikibooks', slug: { $exists: false }, id: { $nin: ['wikibooks-3'] } },
            [{ $set: { slug: '$id' } }]
        );
    });

    it('only treats Wikibooks-shaped slugs from other sources as claimed', async () => {
        const { repo, collection } = setupLibrary([doc('user-1', 'user', 'wikibooks-soup')]);
        await repo.assignWikibooksSlugs();
        expect(collection.distinct).toHaveBeenCalledTimes(1);
        expect(collection.updateMany.mock.calls[0]?.[0]).toMatchObject({ id: { $nin: [] } });
    });
});
