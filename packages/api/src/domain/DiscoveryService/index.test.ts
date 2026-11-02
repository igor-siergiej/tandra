import { describe, expect, it, vi } from 'bun:test';

import type { DiscoveryRecipe } from '@tandra/types';

import type { DiscoveryRecipeRepository } from '../DiscoveryRecipeRepository';
import { DiscoveryService } from './index';
import type { DiscoveryIndex } from './types';

const recipe = (id: string): DiscoveryRecipe => ({
    id,
    title: `Recipe ${id}`,
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

const setup = () => {
    const calls: string[] = [];
    const stored = new Map<string, DiscoveryRecipe>();
    const repository: DiscoveryRecipeRepository = {
        ensureIndexes: vi.fn(),
        getById: vi.fn(async (id: string) => stored.get(id) ?? null),
        upsert: vi.fn(async (r: DiscoveryRecipe) => {
            calls.push('mongo:upsert');
            stored.set(r.id, r);
        }),
        deleteById: vi.fn(async (id: string) => {
            calls.push('mongo:delete');
            stored.delete(id);
        }),
        findByTitle: vi.fn(async () => []),
        hasCoverImageKey: vi.fn(async () => false),
        listRevisions: vi.fn(async () => []),
        batches: vi.fn(async function* () {
            yield [...stored.values()];
        }),
    };
    const index: DiscoveryIndex = {
        ensureIndex: vi.fn(),
        index: vi.fn(async () => {
            calls.push('index:index');
        }),
        remove: vi.fn(async () => {
            calls.push('index:remove');
        }),
        search: vi.fn(async (q) => ({
            hits: [],
            total: 0,
            page: q.page,
            pageSize: q.pageSize,
            facets: { tags: [], difficulty: [], source: [], ingredients: [], time: [] },
        })),
        similar: vi.fn(async () => []),
        rebuild: vi.fn(async (batches) => {
            let n = 0;
            for await (const batch of batches) n += batch.length;
            return n;
        }),
    };
    return { service: new DiscoveryService(repository, index), repository, index, calls, stored };
};

describe('search query normalisation', () => {
    const normalised = async (query: Parameters<DiscoveryService['search']>[0]) => {
        const { service, index } = setup();
        await service.search(query);
        return (index.search as ReturnType<typeof vi.fn>).mock.calls[0][0];
    };

    it('applies defaults and drops blank, duplicate and differently-cased values', async () => {
        const q = await normalised({
            q: '  ',
            tags: [' Vegan ', 'vegan', '', 'Quick'],
            ingredients: [' olive oil ', ''],
        });
        expect(q).toMatchObject({ q: undefined, tags: ['vegan', 'quick'], ingredients: ['olive oil'], page: 1 });
        expect(q.difficulty).toEqual([]);
        expect(q.source).toEqual([]);
    });

    it('bounds page size', async () => {
        expect((await normalised({ pageSize: 10_000 })).pageSize).toBe(50);
        expect((await normalised({ pageSize: 0 })).pageSize).toBe(1);
    });

    it('rejects paging past the result window with a 400', async () => {
        const { service, index } = setup();
        await expect(service.search({ page: 201, pageSize: 50 })).rejects.toMatchObject({ status: 400 });
        expect(index.search).not.toHaveBeenCalled();
        await expect(service.search({ page: 200, pageSize: 50 })).resolves.toBeDefined();
    });
});

describe('DiscoveryService', () => {
    it('writes Mongo before the index, so a failed index write is repairable by a reindex', async () => {
        const { service, index, calls, stored } = setup();
        (index.index as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('engine down'));

        await expect(service.save(recipe('a'))).rejects.toThrow('engine down');

        expect(stored.has('a')).toBe(true);
        expect(calls).toEqual(['mongo:upsert']);
    });

    it('removes from Mongo first, then the index', async () => {
        const { service, calls } = setup();
        await service.save(recipe('a'));
        calls.length = 0;
        await service.remove('a');
        expect(calls).toEqual(['mongo:delete', 'index:remove']);
    });

    it('404s an unknown library recipe', async () => {
        const { service } = setup();
        await expect(service.getRecipe('nope')).rejects.toMatchObject({ status: 404 });
    });

    it('does not query the index for similar recipes of a recipe that is not in the library', async () => {
        const { service, index } = setup();
        await expect(service.getSimilar('nope')).rejects.toMatchObject({ status: 404 });
        expect(index.similar).not.toHaveBeenCalled();
    });

    it('bounds the similar-recipes limit', async () => {
        const { service, index } = setup();
        await service.save(recipe('a'));
        await service.getSimilar('a', 10_000);
        expect(index.similar).toHaveBeenCalledWith('a', 20);
    });

    it('reindexes everything held in Mongo', async () => {
        const { service } = setup();
        await service.save(recipe('a'));
        await service.save(recipe('b'));
        expect(await service.reindex()).toBe(2);
    });

    it('passes the normalised query to the index', async () => {
        const { service, index } = setup();
        await service.search({ q: ' soup ', tags: ['Vegan'] });
        expect(index.search).toHaveBeenCalledWith(expect.objectContaining({ q: 'soup', tags: ['vegan'], page: 1 }));
    });
});
