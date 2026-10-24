import type { DiscoveryRecipe, DiscoverySource } from '@tandra/types';

/** Outcome of giving slugless Wikibooks recipes their id as slug. */
export interface WikibooksSlugBackfill {
    /** Recipes that got a slug in this run; 0 once the library is done. */
    assigned: number;
    /** Ids left slugless because a recipe from another source already owns that slug. */
    blocked: string[];
}

/** System of record for the shared recipe library (`discoveryRecipes`). Personal recipes never pass through here. */
export interface DiscoveryRecipeRepository {
    ensureIndexes(): Promise<void>;
    /**
     * Sets `slug = id` on every Wikibooks recipe without a slug (stored before ingest set one), skipping any whose id
     * is already another recipe's slug. Idempotent; needs `ensureIndexes` first.
     */
    assignWikibooksSlugs(): Promise<WikibooksSlugBackfill>;
    getById(id: string): Promise<DiscoveryRecipe | null>;
    /** Library recipe that has the given URL slug, or null. A Wikibooks recipe's slug is its id. */
    getBySlug(slug: string): Promise<DiscoveryRecipe | null>;
    /** The library recipes with these ids in one query; ids that no longer exist are simply absent. */
    getByIds(ids: string[]): Promise<DiscoveryRecipe[]>;
    upsert(recipe: DiscoveryRecipe): Promise<void>;
    deleteById(id: string): Promise<void>;
    /** Library recipes whose title equals `title`, ignoring case: candidates when checking a new recipe for a duplicate. */
    findByTitle(title: string): Promise<DiscoveryRecipe[]>;
    /** True while some library recipe still uses this cover key: the image is only served for as long as it does. */
    hasCoverImageKey(key: string): Promise<boolean>;
    /** Id and source revision of every recipe from `source`: what a refresh diffs against, without loading the recipes. */
    listRevisions(
        source: DiscoverySource
    ): Promise<Array<Pick<DiscoveryRecipe, 'id' | 'sourceRevision' | 'imageRevision' | 'createdAt'>>>;
    /**
     * Public-facing list: recipes that have a `slug`, ordered by `createdAt DESC, _id DESC` for stable
     * cursor pagination. Pass `after` to fetch the page starting after that id; null on the last page.
     */
    listPublic(pageSize: number, after: string | null): Promise<DiscoveryRecipe[]>;
    /** Whether `slug` is already used by a different library recipe. Used to settle collisions on publish. */
    hasSlug(slug: string): Promise<boolean>;
    /** Every library recipe, in stable order, in batches — feeds a full reindex without loading the library at once. */
    batches(size: number): AsyncGenerator<DiscoveryRecipe[]>;
}
