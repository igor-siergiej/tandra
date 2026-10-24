import { describe, expect, it, vi } from 'bun:test';
import type { DiscoveryRecipe } from '@tandra/types';

import { RuleIngredientStructurer } from '../RuleIngredientStructurer';
import type { CoverOutcome } from './cover';
import { type DiscoveryWriter, WikibooksIngestService } from './index';
import type { RecipeEstimate, WikibooksImageInfo, WikibooksPage, WikibooksPageRef } from './types';

const page = (pageId: number, revisionId: number, extra = ''): WikibooksPage => ({
    pageId,
    revisionId,
    title: `Cookbook:Recipe ${pageId}`,
    wikitext: `{{recipesummary|category=Soup recipes|servings=4|time=30 minutes|difficulty=2}}
==Ingredients==
* 2 cups water${extra}
==Procedure==
# Boil it.`,
});

const withImage = (p: WikibooksPage, file = 'Soup.jpg'): WikibooksPage => ({
    ...p,
    wikitext: p.wikitext.replace('|difficulty=2', `|difficulty=2|image=[[File:${file}|300px]]`),
});

type MockFn = ReturnType<typeof vi.fn>;

const foundImage = (): WikibooksImageInfo => ({ found: true, mime: 'image/jpeg' });

const ref = ({ pageId, title, revisionId }: WikibooksPage): WikibooksPageRef => ({ pageId, title, revisionId });

const setup = (initial: DiscoveryRecipe[] = []) => {
    const store = new Map(initial.map((recipe) => [recipe.id, recipe]));
    const discovery: DiscoveryWriter = {
        save: vi.fn(async (recipe: DiscoveryRecipe) => {
            store.set(recipe.id, recipe);
        }),
        remove: vi.fn(async (id: string) => {
            store.delete(id);
        }),
        getRecipe: vi.fn(async (id: string) => store.get(id) as DiscoveryRecipe),
        listRevisions: vi.fn(async () =>
            [...store.values()].map(({ id, sourceRevision, imageRevision, createdAt }) => ({
                id,
                sourceRevision,
                imageRevision,
                createdAt,
            }))
        ),
    };
    const wiki = new Map<number, WikibooksPage>();
    const source = {
        listRecipePages: vi.fn(async () => [...wiki.values()].map(ref)),
        fetchPages: vi.fn(async (refs: WikibooksPageRef[]) =>
            refs.flatMap((r) => (wiki.has(r.pageId) ? [wiki.get(r.pageId) as WikibooksPage] : []))
        ),
        fetchImageInfo: vi.fn(async (names: string[]) => new Map(names.map((name) => [name, foundImage()]))),
        downloadImage: vi.fn(),
    };
    // The cover service has its own tests; here it stores a cover for any page that names a picture.
    const cover = vi.fn(
        async (id: string, file: string | undefined): Promise<CoverOutcome> =>
            file
                ? {
                      fields: {
                          coverImageKey: `discovery-image/${id}/1.jpg`,
                          coverImageAttribution: 'Photo: Jane, CC BY 2.0, via Wikimedia Commons',
                          coverImageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Soup.jpg',
                      },
                      decided: true,
                  }
                : { fields: {}, decided: true }
    );
    const tagger = { generateTags: vi.fn(async (_title: string): Promise<string[]> => ['broth']) };
    const estimator = {
        estimate: vi.fn(
            async (_recipe: unknown, _fields: string[]): Promise<RecipeEstimate> => ({
                prepTime: 7,
                cookTime: 40,
                servings: 3,
                difficulty: 'hard',
            })
        ),
    };
    let n = 0;
    const service = new WikibooksIngestService(
        source,
        discovery,
        new RuleIngredientStructurer(),
        tagger,
        estimator,
        { generate: () => `ing-${++n}` },
        { resolve: cover }
    );
    return { service, store, wiki, source, discovery, tagger, estimator, cover };
};

describe('WikibooksIngestService', () => {
    it('loads every recipe page once, keyed by page id and stamped with its revision', async () => {
        const { service, store, wiki } = setup();
        wiki.set(1, page(1, 100));
        wiki.set(2, page(2, 200));

        const summary = await service.run();

        expect(summary).toMatchObject({ listed: 2, created: 2, updated: 0, failed: 0 });
        const recipe = store.get('wikibooks-1');
        expect(recipe).toMatchObject({
            title: 'Recipe 1',
            source: 'wikibooks',
            licence: 'CC-BY-SA-4.0',
            sourceUrl: 'https://en.wikibooks.org/wiki/Cookbook:Recipe_1',
            sourceRevision: 100,
            tags: ['soup', 'broth'],
            servings: 4,
            cookTime: 30,
            difficulty: 'medium',
        });
        expect(recipe?.attribution).toContain('"Recipe 1" from Wikibooks Cookbook, CC BY-SA 4.0');
    });

    it('is idempotent: a second run skips unchanged revisions without touching LLM, store or fetch', async () => {
        const { service, wiki, discovery, tagger, source } = setup();
        wiki.set(1, page(1, 100));
        await service.run();
        (discovery.save as unknown as { mockClear(): void }).mockClear();
        tagger.generateTags.mockClear();
        source.fetchPages.mockClear();

        const summary = await service.run();

        expect(summary).toMatchObject({ unchanged: 1, created: 0, updated: 0 });
        expect(discovery.save).not.toHaveBeenCalled();
        expect(tagger.generateTags).not.toHaveBeenCalled();
        expect(source.fetchPages).not.toHaveBeenCalled();
    });

    it('re-processes an edited page, keeping its original createdAt', async () => {
        const { service, store, wiki } = setup();
        wiki.set(1, page(1, 100));
        await service.run();
        const created = store.get('wikibooks-1')?.createdAt;
        wiki.set(1, page(1, 101, '\n* 1 tsp salt'));

        const summary = await service.run();

        expect(summary).toMatchObject({ updated: 1, created: 0 });
        expect(store.get('wikibooks-1')?.ingredients).toHaveLength(2);
        expect(store.get('wikibooks-1')?.sourceRevision).toBe(101);
        expect(store.get('wikibooks-1')?.createdAt).toEqual(created as Date);
    });

    it('gives every recipe it creates or updates its id as public slug', async () => {
        const { service, store, wiki } = setup();
        wiki.set(1, page(1, 100));
        await service.run();
        expect(store.get('wikibooks-1')?.slug).toBe('wikibooks-1');

        // An edit rebuilds the recipe from scratch; the slug must come back with it.
        wiki.set(1, page(1, 101, '\n* 1 tsp salt'));
        await service.run();
        expect(store.get('wikibooks-1')?.slug).toBe('wikibooks-1');
    });

    it('removes a recipe whose page was deleted, and one that stopped being a recipe', async () => {
        const { service, store, wiki } = setup();
        for (let id = 1; id <= 10; id += 1) wiki.set(id, page(id, 100 + id));
        await service.run();
        wiki.delete(1);
        wiki.set(2, { ...page(2, 999), wikitext: 'Now just an index page.' });

        const summary = await service.run();

        expect(summary).toMatchObject({ removed: 2, skipped: 1 });
        expect(store.has('wikibooks-1')).toBe(false);
        expect(store.has('wikibooks-2')).toBe(false);
        expect(store.size).toBe(8);
    });

    it('refuses to delete an implausible share of the library when the listing looks broken', async () => {
        const { service, store, wiki, discovery } = setup();
        for (let id = 1; id <= 10; id += 1) wiki.set(id, page(id, 100));
        await service.run();
        for (let id = 1; id <= 8; id += 1) wiki.delete(id);

        const summary = await service.run();

        expect(summary).toMatchObject({ removed: 0, removalsBlocked: 8 });
        expect(discovery.remove).not.toHaveBeenCalled();
        expect(store.size).toBe(10);
    });

    it('survives a page that fails: logs it, keeps the old copy and retries it on the next run', async () => {
        const { service, store, wiki, tagger } = setup();
        wiki.set(1, page(1, 100));
        wiki.set(2, page(2, 200));
        await service.run();
        wiki.set(1, page(1, 101));
        wiki.set(2, page(2, 201));
        tagger.generateTags.mockImplementation(async (title: string) => {
            if (title === 'Recipe 1') throw new Error('rate limited');
            return ['broth'];
        });

        const failing = await service.run();

        expect(failing).toMatchObject({ updated: 1, failed: 1, removed: 0 });
        expect(store.get('wikibooks-1')?.sourceRevision).toBe(100);
        expect(store.get('wikibooks-2')?.sourceRevision).toBe(201);

        tagger.generateTags.mockImplementation(async () => ['broth']);
        const retry = await service.run();
        expect(retry).toMatchObject({ updated: 1, failed: 0, unchanged: 1 });
        expect(store.get('wikibooks-1')?.sourceRevision).toBe(101);
    });

    it('counts pages the source could not fetch as failed without aborting the run', async () => {
        const { service, wiki, source, store } = setup();
        wiki.set(1, page(1, 100));
        wiki.set(2, page(2, 200));
        source.fetchPages.mockImplementationOnce(async (refs: WikibooksPageRef[]) =>
            refs.filter((r) => r.pageId === 2).map((r) => wiki.get(r.pageId) as WikibooksPage)
        );

        const summary = await service.run();

        expect(summary).toMatchObject({ created: 1, failed: 1 });
        expect(store.has('wikibooks-2')).toBe(true);
    });

    it('aborts before writing or removing anything when the listing itself fails', async () => {
        const { service, source, discovery } = setup();
        source.listRecipePages.mockRejectedValueOnce(new Error('Wikibooks API: HTTP 503'));

        await expect(service.run()).rejects.toThrow('HTTP 503');
        expect(discovery.save).not.toHaveBeenCalled();
        expect(discovery.remove).not.toHaveBeenCalled();
    });

    it('limits a trial run to the first N new or changed pages', async () => {
        const { service, store, wiki } = setup();
        for (let id = 1; id <= 5; id += 1) wiki.set(id, page(id, 100));

        const summary = await service.run({ limit: 2 });

        expect(summary).toMatchObject({ created: 2 });
        expect(store.size).toBe(2);
    });

    describe('estimated fields', () => {
        it('does not call the estimator, or flag anything, when the source states every field', async () => {
            const { service, store, wiki, estimator } = setup();
            wiki.set(1, page(1, 100));
            await service.run();

            expect(estimator.estimate).not.toHaveBeenCalled();
            expect(store.get('wikibooks-1')?.estimated).toBeUndefined();
        });

        it('estimates only the gaps and records exactly those fields in `estimated`', async () => {
            const { service, store, wiki, estimator } = setup();
            wiki.set(1, { ...page(1, 100), wikitext: page(1, 100).wikitext.replace('|servings=4', '') });
            await service.run();

            expect(estimator.estimate).toHaveBeenCalledTimes(1);
            expect(estimator.estimate.mock.calls[0]?.[1]).toEqual(['servings']);
            expect(store.get('wikibooks-1')).toMatchObject({ servings: 3, cookTime: 30, estimated: ['servings'] });
        });

        it('estimates both times when the source gives none, and never overrides a stated value', async () => {
            const { service, store, wiki } = setup();
            wiki.set(1, { ...page(1, 100), wikitext: page(1, 100).wikitext.replace('|time=30 minutes', '') });
            await service.run();

            const recipe = store.get('wikibooks-1');
            expect(recipe).toMatchObject({ prepTime: 7, cookTime: 40, servings: 4, difficulty: 'medium' });
            expect(recipe?.estimated).toEqual(['prepTime', 'cookTime']);
        });

        it('does not invent a prep time next to a single stated total', async () => {
            const { service, store, wiki, estimator } = setup();
            wiki.set(1, page(1, 100));
            await service.run();

            expect(store.get('wikibooks-1')?.prepTime).toBeUndefined();
            expect(estimator.estimate).not.toHaveBeenCalled();
        });

        it('drops an estimate for a field that was not asked for', async () => {
            const { service, store, wiki, estimator } = setup();
            wiki.set(1, { ...page(1, 100), wikitext: page(1, 100).wikitext.replace('|servings=4', '') });
            estimator.estimate.mockResolvedValueOnce({ servings: 2, difficulty: 'hard', prepTime: 99 });
            await service.run();

            expect(store.get('wikibooks-1')).toMatchObject({
                servings: 2,
                difficulty: 'medium',
                estimated: ['servings'],
            });
            expect(store.get('wikibooks-1')?.prepTime).toBeUndefined();
        });
    });

    it('fails a page that ends up with no tags rather than storing an unfindable recipe', async () => {
        const { service, store, wiki, tagger } = setup();
        wiki.set(1, { ...page(1, 100), wikitext: page(1, 100).wikitext.replace('category=Soup recipes|', '') });
        tagger.generateTags.mockResolvedValue([]);

        const summary = await service.run();

        expect(summary).toMatchObject({ failed: 1, created: 0 });
        expect(store.size).toBe(0);
    });

    describe('cover pictures', () => {
        it('stores the cover and its credit with a new recipe, and stamps the revision it looked at', async () => {
            const { service, store, wiki, source } = setup();
            wiki.set(1, withImage(page(1, 100)));

            const summary = await service.run();

            expect(summary).toMatchObject({ created: 1, covers: 1 });
            expect(store.get('wikibooks-1')).toMatchObject({
                coverImageKey: 'discovery-image/wikibooks-1/1.jpg',
                coverImageAttribution: 'Photo: Jane, CC BY 2.0, via Wikimedia Commons',
                coverImageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Soup.jpg',
                imageRevision: 100,
            });
            expect(source.fetchImageInfo).toHaveBeenCalledWith(['Soup.jpg']);
        });

        it('asks the wiki about a whole batch of pictures in one request', async () => {
            const { service, wiki, source } = setup();
            for (let id = 1; id <= 5; id += 1) wiki.set(id, withImage(page(id, 100), `Soup ${id}.jpg`));

            await service.run();

            expect(source.fetchImageInfo).toHaveBeenCalledTimes(1);
            expect((source.fetchImageInfo as unknown as MockFn).mock.calls[0]?.[0]).toHaveLength(5);
        });

        it('stamps a page with no picture as looked at, so it is not fetched again', async () => {
            const { service, store, wiki, source } = setup();
            wiki.set(1, page(1, 100));

            await service.run();
            expect(store.get('wikibooks-1')).toMatchObject({ imageRevision: 100 });
            expect(store.get('wikibooks-1')?.coverImageKey).toBeUndefined();
            expect(source.fetchImageInfo).not.toHaveBeenCalled();

            source.fetchPages.mockClear();
            const again = await service.run();
            expect(again).toMatchObject({ unchanged: 1, created: 0, covers: 0 });
            expect(source.fetchPages).not.toHaveBeenCalled();
        });

        it('keeps a refused picture refused: counted once, stamped, and not looked at again', async () => {
            const { service, store, wiki, cover, source } = setup();
            cover.mockResolvedValue({ fields: {}, decided: true, refused: 'licence not reusable: CC BY-NC 2.0' });
            wiki.set(1, withImage(page(1, 100)));

            const first = await service.run();
            source.fetchPages.mockClear();
            const second = await service.run();

            expect(first).toMatchObject({ created: 1, covers: 0, coversRefused: 1 });
            expect(store.get('wikibooks-1')).toMatchObject({ imageRevision: 100 });
            expect(second).toMatchObject({ coversRefused: 0 });
            expect(source.fetchPages).not.toHaveBeenCalled();
        });

        it('saves the recipe without a cover when the picture fails, and retries only the picture next run', async () => {
            const { service, store, wiki, cover, tagger, estimator } = setup();
            cover.mockResolvedValueOnce({ fields: {}, decided: false });
            wiki.set(1, withImage(page(1, 100)));

            const first = await service.run();
            expect(first).toMatchObject({ created: 1, covers: 0, coversFailed: 1 });
            expect(store.get('wikibooks-1')).toBeDefined();
            expect(store.get('wikibooks-1')?.imageRevision).toBeUndefined();
            tagger.generateTags.mockClear();
            estimator.estimate.mockClear();

            const second = await service.run();

            expect(second).toMatchObject({ unchanged: 1, created: 0, covers: 1 });
            expect(store.get('wikibooks-1')).toMatchObject({
                coverImageKey: 'discovery-image/wikibooks-1/1.jpg',
                imageRevision: 100,
            });
            // The retry is the picture only: no LLM, no rebuild.
            expect(tagger.generateTags).not.toHaveBeenCalled();
            expect(estimator.estimate).not.toHaveBeenCalled();
        });

        it('gives covers to recipes ingested before covers existed, changing nothing else', async () => {
            const { service, store, wiki, tagger, source } = setup();
            wiki.set(1, page(1, 100));
            await service.run();
            // Roll the stored recipe back to how an older ingest left it: same revision, never looked at for a
            // picture, and no slug.
            const old = store.get('wikibooks-1') as DiscoveryRecipe;
            const { imageRevision: _dropped, slug: _noSlug, ...legacy } = old;
            store.set('wikibooks-1', { ...legacy, tags: ['hand-edited tag'] } as DiscoveryRecipe);
            wiki.set(1, withImage(page(1, 100)));
            tagger.generateTags.mockClear();
            (source.fetchImageInfo as unknown as MockFn).mockClear();

            const summary = await service.run();

            expect(summary).toMatchObject({ unchanged: 1, created: 0, updated: 0, covers: 1 });
            expect(store.get('wikibooks-1')).toMatchObject({
                coverImageKey: 'discovery-image/wikibooks-1/1.jpg',
                imageRevision: 100,
                slug: 'wikibooks-1',
                tags: ['hand-edited tag'],
                updatedAt: old.updatedAt,
            });
            expect(tagger.generateTags).not.toHaveBeenCalled();
        });

        it('drops the old cover when an edited page no longer has one', async () => {
            const { service, store, wiki } = setup();
            wiki.set(1, withImage(page(1, 100)));
            await service.run();
            expect(store.get('wikibooks-1')?.coverImageKey).toBeDefined();

            wiki.set(1, page(1, 101));
            await service.run();

            expect(store.get('wikibooks-1')?.coverImageKey).toBeUndefined();
            expect(store.get('wikibooks-1')?.coverImageAttribution).toBeUndefined();
            expect(store.get('wikibooks-1')).toMatchObject({ imageRevision: 101 });
        });

        it('counts a recipe whose cover pass throws as a failed cover and carries on with the others', async () => {
            const { service, store, wiki, discovery } = setup();
            wiki.set(1, page(1, 100));
            wiki.set(2, page(2, 200));
            await service.run();
            for (const id of ['wikibooks-1', 'wikibooks-2']) {
                const { imageRevision: _dropped, ...legacy } = store.get(id) as DiscoveryRecipe;
                store.set(id, legacy as DiscoveryRecipe);
            }
            wiki.set(1, withImage(page(1, 100)));
            wiki.set(2, withImage(page(2, 200)));
            (discovery.getRecipe as unknown as MockFn).mockRejectedValueOnce(new Error('mongo hiccup'));

            const summary = await service.run();

            expect(summary).toMatchObject({ covers: 1, coversFailed: 1 });
        });
    });
});
