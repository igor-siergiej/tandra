import { describe, expect, it, vi } from 'bun:test';

import { errors } from '@opensearch-project/opensearch';
import type { DiscoveryRecipe } from '@tandra/types';

import type { NormalizedDiscoveryQuery } from '../../domain/DiscoveryService/types';
import { fake } from '../../testing/fake';
import { toIndexDocument } from './document';
import { type OpenSearchApi, OpenSearchDiscoveryIndex } from './index';

const recipe = (overrides: Partial<DiscoveryRecipe> = {}): DiscoveryRecipe => ({
    id: 'a',
    title: 'Soup',
    ingredients: [
        { id: '1', name: 'water', quantity: 2, unit: 'l' },
        { id: '2', name: 'salt' },
    ],
    instructions: ['Boil.'],
    tags: ['soup'],
    source: 'wikibooks',
    sourceUrl: 'https://example.test',
    licence: 'CC-BY-SA-4.0',
    attribution: 'Wikibooks contributors',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
});

const normalizeQuery = (query: Partial<NormalizedDiscoveryQuery>): NormalizedDiscoveryQuery => ({
    tags: [],
    ingredients: [],
    difficulty: [],
    source: [],
    page: 1,
    pageSize: 20,
    ...query,
});

const responseError = (statusCode: number, type = 'x') =>
    new errors.ResponseError({ statusCode, body: { error: { type } }, headers: {}, meta: fake({}), warnings: null });

const fakeApi = (overrides: Partial<Record<'search' | 'bulk' | 'index' | 'delete', ReturnType<typeof vi.fn>>> = {}) => {
    const api = {
        indices: {
            existsAlias: vi.fn().mockResolvedValue({ body: true }),
            create: vi.fn().mockResolvedValue({ body: {} }),
            delete: vi.fn().mockResolvedValue({ body: {} }),
            refresh: vi.fn().mockResolvedValue({ body: {} }),
            getAlias: vi.fn().mockResolvedValue({ body: { 'discovery-recipes-000001': {} } }),
            updateAliases: vi.fn().mockResolvedValue({ body: {} }),
        },
        index: vi.fn().mockResolvedValue({ body: {} }),
        delete: vi.fn().mockResolvedValue({ body: {} }),
        search: vi.fn().mockResolvedValue({ body: { hits: { total: { value: 0 }, hits: [] } } }),
        bulk: vi.fn().mockResolvedValue({ body: { errors: false, items: [] } }),
        ...overrides,
    };

    return api;
};

const asApi = (api: ReturnType<typeof fakeApi>) => fake<OpenSearchApi>(api);

describe('toIndexDocument', () => {
    it('flattens ingredients to names and derives total time from whichever times exist', () => {
        const doc = toIndexDocument(recipe({ prepTime: 10, cookTime: 25 }));
        expect(doc.ingredientNames).toEqual(['water', 'salt']);
        expect(doc.totalTime).toBe(35);
        expect(toIndexDocument(recipe({ cookTime: 25 })).totalTime).toBe(25);
        expect(toIndexDocument(recipe({ prepTime: 5 })).totalTime).toBe(5);
    });

    it('leaves total time unset when the recipe has no time, so time filters never match it', () => {
        expect(toIndexDocument(recipe()).totalTime).toBeUndefined();
    });

    it('keeps instructions and quantities out of the index', () => {
        const doc = toIndexDocument(recipe());
        expect(doc).not.toHaveProperty('instructions');
        expect(doc).not.toHaveProperty('ingredients');
    });
});

describe('OpenSearchDiscoveryIndex availability', () => {
    it('answers 503 for every operation when no OpenSearch is configured', async () => {
        const index = new OpenSearchDiscoveryIndex(null);
        await expect(index.search(normalizeQuery({}))).rejects.toMatchObject({ status: 503 });
        await expect(index.similar('a', 3)).rejects.toMatchObject({ status: 503 });
        await expect(index.index(recipe())).rejects.toMatchObject({ status: 503 });
    });

    it.each([
        ['connection refused', new errors.ConnectionError('ECONNREFUSED')],
        ['timeout', new errors.TimeoutError('Request timed out')],
        ['no living connections', new errors.NoLivingConnectionsError('none', fake({}))],
        ['gateway 503 from the engine', responseError(503)],
    ])('turns "%s" into a 503', async (_name, failure) => {
        const api = fakeApi({ search: vi.fn().mockRejectedValue(failure) });
        const index = new OpenSearchDiscoveryIndex(asApi(api));
        await expect(index.search(normalizeQuery({ q: 'soup' }))).rejects.toMatchObject({ status: 503 });
    });

    it('does not disguise a rejected query as an outage', async () => {
        const failure = responseError(400, 'parsing_exception');
        const api = fakeApi({ search: vi.fn().mockRejectedValue(failure) });
        const index = new OpenSearchDiscoveryIndex(asApi(api));
        await expect(index.search(normalizeQuery({ q: 'soup' }))).rejects.toBe(failure);
    });

    it('creates the index lazily, so an engine that was down at startup recovers without a restart', async () => {
        const api = fakeApi();
        api.indices.existsAlias
            .mockRejectedValueOnce(new errors.ConnectionError('down'))
            .mockResolvedValue({ body: false });
        const index = new OpenSearchDiscoveryIndex(asApi(api));

        await expect(index.search(normalizeQuery({}))).rejects.toMatchObject({ status: 503 });
        await index.search(normalizeQuery({}));
        await index.search(normalizeQuery({}));

        expect(api.indices.create).toHaveBeenCalledTimes(1);
        expect(api.indices.existsAlias).toHaveBeenCalledTimes(2);
    });

    it('treats losing the create race to another API instance as success', async () => {
        const api = fakeApi();
        api.indices.existsAlias.mockResolvedValue({ body: false });
        api.indices.create.mockRejectedValue(responseError(400, 'resource_already_exists_exception'));
        await expect(new OpenSearchDiscoveryIndex(asApi(api)).ensureIndex()).resolves.toBeUndefined();
    });

    it('surfaces any other failure to create the index', async () => {
        const api = fakeApi();
        api.indices.existsAlias.mockResolvedValue({ body: false });
        api.indices.create.mockRejectedValue(responseError(400, 'illegal_argument_exception'));
        await expect(new OpenSearchDiscoveryIndex(asApi(api)).ensureIndex()).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('OpenSearchDiscoveryIndex rebuild', () => {
    async function* one(...recipes: DiscoveryRecipe[]) {
        yield recipes;
    }

    it('swaps the alias atomically and only then deletes the old index', async () => {
        const order: string[] = [];
        const api = fakeApi();
        api.indices.updateAliases.mockImplementation(async () => order.push('swap'));
        api.indices.delete.mockImplementation(async ({ index }: { index: string }) => order.push(`delete:${index}`));

        await new OpenSearchDiscoveryIndex(asApi(api)).rebuild(one(recipe()));

        expect(order).toEqual(['swap', 'delete:discovery-recipes-000001']);
        const [{ body }] = api.indices.updateAliases.mock.calls[0];
        expect(body.actions).toEqual([
            { remove: { index: 'discovery-recipes-000001', alias: 'discovery-recipes' } },
            { add: { index: expect.stringMatching(/^discovery-recipes-\d+$/), alias: 'discovery-recipes' } },
        ]);
    });

    it('drops the half-built index and keeps the old one when a bulk item fails', async () => {
        const api = fakeApi();
        api.bulk.mockResolvedValue({
            body: { errors: true, items: [{ index: { error: { type: 'mapper_parsing_exception' } } }] },
        });

        await expect(new OpenSearchDiscoveryIndex(asApi(api)).rebuild(one(recipe()))).rejects.toThrow(
            /Bulk indexing failed/
        );

        expect(api.indices.updateAliases).not.toHaveBeenCalled();
        expect(api.indices.delete).toHaveBeenCalledTimes(1);
        expect(api.indices.delete.mock.calls[0][0].index).toMatch(/^discovery-recipes-\d+$/);
    });
});
