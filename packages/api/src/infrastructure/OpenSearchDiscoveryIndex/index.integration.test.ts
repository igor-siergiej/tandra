/**
 * Runs against a real OpenSearch. Skipped unless OPENSEARCH_TEST_URL is set (CI provides a service container).
 * A dedicated variable, not OPENSEARCH_URL: this suite deletes every `discovery-recipes*` index it finds.
 *
 *   docker run -d -p 9200:9200 -e discovery.type=single-node -e DISABLE_SECURITY_PLUGIN=true \
 *     -e DISABLE_INSTALL_DEMO_CONFIG=true opensearchproject/opensearch:2.19.1
 *   OPENSEARCH_TEST_URL=http://localhost:9200 bun test OpenSearchDiscoveryIndex
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { Client } from '@opensearch-project/opensearch';
import type { DiscoveryRecipe } from '@tandra/types';

import { DiscoveryService } from '../../domain/DiscoveryService';
import { type OpenSearchApi, OpenSearchDiscoveryIndex } from './index';
import { DEFAULT_INDEX_ALIAS as INDEX_ALIAS } from './mapping';

const url = process.env.OPENSEARCH_TEST_URL;

const NOW = new Date('2026-01-01T00:00:00Z');

const recipe = (id: string, overrides: Partial<DiscoveryRecipe> = {}): DiscoveryRecipe => ({
    id,
    title: `Recipe ${id}`,
    ingredients: [],
    instructions: ['Cook it.'],
    tags: [],
    source: 'wikibooks',
    sourceUrl: `https://en.wikibooks.org/wiki/Cookbook:${id}`,
    licence: 'CC-BY-SA-4.0',
    attribution: 'Wikibooks contributors',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
});

const ing = (...names: string[]) => names.map((name, i) => ({ id: `${name}-${i}`, name }));

describe.skipIf(!url)('OpenSearchDiscoveryIndex (real OpenSearch)', () => {
    const client = new Client({ node: url ?? 'http://localhost:9200' });
    const index = new OpenSearchDiscoveryIndex(client as unknown as OpenSearchApi);

    const wipe = async () => {
        await client.indices.delete({ index: 'discovery-recipes*' }, { ignore: [404] });
    };
    const load = async (...recipes: DiscoveryRecipe[]) => {
        for (const r of recipes) await index.index(r);
        await client.indices.refresh({ index: INDEX_ALIAS });
    };
    // Through the service, so queries are normalised exactly as the API does it.
    const service = new DiscoveryService({} as never, index);
    const search = (q: Parameters<DiscoveryService['search']>[0]) => service.search(q);
    const ids = (result: { hits: Array<{ id: string }> }) => result.hits.map((h) => h.id);

    beforeAll(wipe);
    afterAll(wipe);
    beforeEach(async () => {
        await wipe();
        // A fresh instance each time: it memoises "index exists".
        (index as unknown as { ready: unknown }).ready = null;
    });

    it('ensureIndex is idempotent and creates one concrete index behind the alias', async () => {
        await index.ensureIndex();
        (index as unknown as { ready: unknown }).ready = null;
        await index.ensureIndex();

        const { body } = await client.indices.getAlias({ name: INDEX_ALIAS });
        expect(Object.keys(body)).toHaveLength(1);
    });

    it('uses an explicit strict mapping: unknown fields are rejected instead of mapped dynamically', async () => {
        await index.ensureIndex();
        // The client returns a thenable, not a Promise, so `.rejects` cannot be used on it directly.
        const attempt = (async () =>
            client.index({ index: INDEX_ALIAS, id: 'x', body: { title: 'x', surprise: 'field' } }))();
        await expect(attempt).rejects.toThrow(/strict_dynamic_mapping_exception/);
    });

    it('keeps instances on different aliases apart, including across a rebuild', async () => {
        // Inside the `discovery-recipes*` pattern so `wipe` cleans it up too.
        const otherAlias = 'discovery-recipes-other';
        const other = new OpenSearchDiscoveryIndex(client as unknown as OpenSearchApi, undefined, otherAlias);
        const otherSearch = (q: Parameters<DiscoveryService['search']>[0]) =>
            new DiscoveryService({} as never, other).search(q);

        await load(recipe('mine'));
        await other.index(recipe('theirs'));
        await client.indices.refresh({ index: otherAlias });
        expect(ids(await search({}))).toEqual(['mine']);
        expect(ids(await otherSearch({}))).toEqual(['theirs']);

        await other.rebuild(
            (async function* () {
                yield [recipe('rebuilt')];
            })()
        );
        expect(ids(await otherSearch({}))).toEqual(['rebuilt']);
        expect(ids(await search({}))).toEqual(['mine']);
    });

    describe('analysis', () => {
        it('matches ingredient synonyms in both directions (aubergine/eggplant, coriander/cilantro)', async () => {
            await load(
                recipe('a', { title: 'Baba ganoush', ingredients: ing('aubergine', 'tahini') }),
                recipe('b', { title: 'Green chutney', ingredients: ing('cilantro', 'mint') }),
                recipe('c', { title: 'Plain rice', ingredients: ing('rice') })
            );

            expect(ids(await search({ q: 'eggplant' }))).toEqual(['a']);
            expect(ids(await search({ q: 'coriander' }))).toEqual(['b']);
            expect(ids(await search({ ingredients: ['eggplant'] }))).toEqual(['a']);
        });

        it('stems, so a plural query matches a singular ingredient', async () => {
            await load(recipe('a', { ingredients: ing('tomato') }), recipe('b', { ingredients: ing('rice') }));
            expect(ids(await search({ q: 'tomatoes' }))).toEqual(['a']);
        });

        it('folds accents in both directions', async () => {
            await load(recipe('a', { title: 'Jalapeño poppers' }), recipe('b', { title: 'Crème brûlée' }));
            expect(ids(await search({ q: 'jalapeno' }))).toEqual(['a']);
            expect(ids(await search({ q: 'creme brulee' }))).toEqual(['b']);
            expect(ids(await search({ q: 'jalapeño' }))).toEqual(['a']);
        });

        it('tolerates typos in the query', async () => {
            await load(recipe('a', { title: 'Chicken curry' }), recipe('b', { title: 'Lentil soup' }));
            expect(ids(await search({ q: 'chiken' }))).toEqual(['a']);
            expect(ids(await search({ q: 'lentl soup' }))).toContain('b');
        });
    });

    describe('relevance', () => {
        it('ranks a title match above an ingredient match above a tag match, despite field length', async () => {
            // Unboosted BM25 would favour the short tag/ingredient fields over a long title; the boosts must win.
            await load(
                recipe('tag-only', { title: 'Weeknight dinner', tags: ['pasta'] }),
                recipe('ingredient-only', { title: 'Weeknight dinner two', ingredients: ing('pasta') }),
                recipe('title-only', {
                    title: 'A quick and easy weeknight pasta dinner the whole family will love',
                    ingredients: ing('salt', 'water', 'butter', 'garlic', 'parsley'),
                    tags: ['dinner', 'family', 'quick', 'easy'],
                })
            );

            expect(ids(await search({ q: 'pasta' }))).toEqual(['title-only', 'ingredient-only', 'tag-only']);
        });

        it('browses newest first when there is no text query', async () => {
            await load(
                recipe('old', { updatedAt: new Date('2025-01-01') }),
                recipe('new', { updatedAt: new Date('2026-06-01') })
            );
            expect(ids(await search({}))).toEqual(['new', 'old']);
        });
    });

    describe('filters', () => {
        const library = () => [
            recipe('soup', {
                title: 'Tomato soup',
                tags: ['soup', 'vegetarian'],
                ingredients: ing('tomato', 'olive oil'),
                prepTime: 10,
                cookTime: 20,
                difficulty: 'easy',
            }),
            recipe('stew', {
                title: 'Beef stew',
                tags: ['stew'],
                ingredients: ing('beef', 'carrot'),
                prepTime: 30,
                cookTime: 120,
                difficulty: 'hard',
                source: 'user',
            }),
            recipe('salad', {
                title: 'Green salad',
                tags: ['vegetarian', 'salad'],
                ingredients: ing('lettuce', 'oil'),
            }),
        ];

        it('requires every selected tag', async () => {
            await load(...library());
            expect(ids(await search({ tags: ['vegetarian'] })).sort()).toEqual(['salad', 'soup']);
            expect(ids(await search({ tags: ['vegetarian', 'soup'] }))).toEqual(['soup']);
            expect(ids(await search({ tags: ['Vegetarian'] })).sort()).toEqual(['salad', 'soup']);
        });

        it('matches an ingredient phrase within one ingredient, never across two', async () => {
            await load(...library());
            // "olive oil" is one ingredient on soup; salad has "lettuce" and "oil" but no olive.
            expect(ids(await search({ ingredients: ['olive oil'] }))).toEqual(['soup']);
            expect(ids(await search({ ingredients: ['oil'] })).sort()).toEqual(['salad', 'soup']);
            expect(ids(await search({ ingredients: ['tomato', 'olive oil'] }))).toEqual(['soup']);
            expect(ids(await search({ ingredients: ['tomato', 'beef'] }))).toEqual([]);
        });

        it('filters by difficulty (any-of) and source', async () => {
            await load(...library());
            expect(ids(await search({ difficulty: ['hard'] }))).toEqual(['stew']);
            expect(ids(await search({ difficulty: ['easy', 'hard'] })).sort()).toEqual(['soup', 'stew']);
            expect(ids(await search({ source: ['user'] }))).toEqual(['stew']);
        });

        it('filters by total time and excludes recipes with no time at all', async () => {
            await load(...library());
            expect(ids(await search({ maxTime: 60 }))).toEqual(['soup']);
            expect(ids(await search({ minTime: 60 }))).toEqual(['stew']);
            expect(ids(await search({ minTime: 0 })).sort()).toEqual(['soup', 'stew']);
        });

        it('combines a text query with filters', async () => {
            await load(...library());
            expect(ids(await search({ q: 'soup stew salad', tags: ['vegetarian'] })).sort()).toEqual(['salad', 'soup']);
        });
    });

    describe('facets and paging', () => {
        it('returns tag, difficulty, source, ingredient and time-range counts for the result set', async () => {
            await load(
                recipe('a', {
                    tags: ['dessert'],
                    difficulty: 'easy',
                    prepTime: 5,
                    cookTime: 5,
                    ingredients: ing('sugar'),
                }),
                recipe('b', {
                    tags: ['dessert', 'baking'],
                    difficulty: 'easy',
                    cookTime: 45,
                    ingredients: ing('sugar'),
                }),
                recipe('c', { tags: ['main'], difficulty: 'hard', source: 'user', prepTime: 200 })
            );

            const { facets } = await search({});
            expect(facets.tags).toEqual(
                expect.arrayContaining([
                    { key: 'dessert', count: 2 },
                    { key: 'baking', count: 1 },
                    { key: 'main', count: 1 },
                ])
            );
            expect(facets.difficulty).toEqual(
                expect.arrayContaining([
                    { key: 'easy', count: 2 },
                    { key: 'hard', count: 1 },
                ])
            );
            expect(facets.source).toEqual(
                expect.arrayContaining([
                    { key: 'wikibooks', count: 2 },
                    { key: 'user', count: 1 },
                ])
            );
            expect(facets.ingredients).toEqual([{ key: 'sugar', count: 2 }]);
            expect(facets.time.map((b) => [b.key, b.count])).toEqual([
                ['under-15', 1],
                ['15-30', 0],
                ['30-60', 1],
                ['60-120', 0],
                ['over-120', 1],
            ]);
        });

        it('facet counts shrink to the filtered result set', async () => {
            await load(
                recipe('a', { tags: ['dessert'], difficulty: 'easy' }),
                recipe('b', { tags: ['main'], difficulty: 'hard' })
            );
            const { facets } = await search({ tags: ['dessert'] });
            expect(facets.difficulty).toEqual([{ key: 'easy', count: 1 }]);
        });

        it('pages without overlap and reports the total', async () => {
            await load(...Array.from({ length: 5 }, (_, i) => recipe(`r${i}`, { title: 'Soup' })));

            const first = await search({ q: 'soup', pageSize: 2, page: 1 });
            const second = await search({ q: 'soup', pageSize: 2, page: 2 });
            const third = await search({ q: 'soup', pageSize: 2, page: 3 });

            expect(first.total).toBe(5);
            expect([first, second, third].map((r) => r.hits.length)).toEqual([2, 2, 1]);
            expect(new Set([...ids(first), ...ids(second), ...ids(third)]).size).toBe(5);
        });

        it('returns summaries, not full documents', async () => {
            await load(recipe('a', { title: 'Soup', ingredients: ing('water'), prepTime: 5, estimated: ['prepTime'] }));
            const [hit] = (await search({})).hits;
            expect(hit).toEqual({
                id: 'a',
                title: 'Soup',
                tags: [],
                prepTime: 5,
                source: 'wikibooks',
                estimated: ['prepTime'],
            });
        });
    });

    describe('similar recipes', () => {
        it('finds recipes that share ingredients, title words and tags, never the recipe itself', async () => {
            await load(
                recipe('lasagne', {
                    title: 'Beef lasagne',
                    tags: ['italian', 'pasta'],
                    ingredients: ing('beef mince', 'pasta sheets', 'tomato'),
                }),
                recipe('bolognese', {
                    title: 'Spaghetti bolognese',
                    tags: ['italian', 'pasta'],
                    ingredients: ing('beef mince', 'spaghetti', 'tomato'),
                }),
                recipe('cake', {
                    title: 'Chocolate cake',
                    tags: ['dessert'],
                    ingredients: ing('flour', 'cocoa', 'sugar'),
                })
            );

            const similar = await index.similar('lasagne', 5);
            expect(similar.map((s) => s.id)).toEqual(['bolognese']);
        });
    });

    describe('writes', () => {
        it('removes a recipe from search and tolerates removing one that is already gone', async () => {
            await load(recipe('a', { title: 'Soup' }));
            await index.remove('a');
            await index.remove('a');
            await client.indices.refresh({ index: INDEX_ALIAS });
            expect((await search({})).total).toBe(0);
        });

        it('reindexing the same id replaces the document', async () => {
            await load(recipe('a', { title: 'Soup' }));
            await load(recipe('a', { title: 'Stew' }));
            expect(ids(await search({ q: 'stew' }))).toEqual(['a']);
            expect(ids(await search({ q: 'soup' }))).toEqual([]);
        });
    });

    describe('rebuild', () => {
        async function* batches(...groups: DiscoveryRecipe[][]) {
            for (const g of groups) yield g;
        }

        it('replaces the index contents from the source of truth and drops the old index', async () => {
            await load(recipe('stale', { title: 'Stale entry' }));

            const count = await index.rebuild(
                batches(
                    [recipe('a', { title: 'Alpha' }), recipe('b', { title: 'Beta' })],
                    [recipe('c', { title: 'Gamma' })]
                )
            );

            expect(count).toBe(3);
            expect((await search({})).total).toBe(3);
            expect(ids(await search({ q: 'stale' }))).toEqual([]);
            const { body } = await client.indices.getAlias({ name: INDEX_ALIAS });
            expect(Object.keys(body)).toHaveLength(1);
            const { body: indices } = await client.cat.indices({ index: 'discovery-recipes*', format: 'json' });
            expect(indices).toHaveLength(1);
        });

        it('leaves the live index untouched and cleans up when the source fails midway', async () => {
            await load(recipe('live', { title: 'Live entry' }));

            async function* failing() {
                yield [recipe('partial')];
                throw new Error('mongo went away');
            }
            await expect(index.rebuild(failing())).rejects.toThrow('mongo went away');

            expect(ids(await search({}))).toEqual(['live']);
            const { body: indices } = await client.cat.indices({ index: 'discovery-recipes*', format: 'json' });
            expect(indices).toHaveLength(1);
        });
    });
});
