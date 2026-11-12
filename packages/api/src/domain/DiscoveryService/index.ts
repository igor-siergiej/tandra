import type { Logger } from '@imapps/api-utils';
import type {
    DiscoveryRecipe,
    DiscoveryRecipeSummary,
    DiscoverySearchQuery,
    DiscoverySearchResult,
    DiscoverySource,
} from '@tandra/types';

import type { DiscoveryRecipeRepository } from '../DiscoveryRecipeRepository';
import type { DiscoveryIndex, NormalizedDiscoveryQuery } from './types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/** OpenSearch's default `index.max_result_window`; deeper pages need search_after, which nothing here needs yet. */
const MAX_RESULT_WINDOW = 10_000;
const DEFAULT_SIMILAR_LIMIT = 6;
const MAX_SIMILAR_LIMIT = 20;
const REINDEX_BATCH_SIZE = 500;

const httpError = (message: string, status: number) => Object.assign(new Error(message), { status });

// Trim/dedupe/lowercase in one pass.
// fallow-ignore-next-line complexity
const clean = (values: string[] | undefined, lowercase = false): string[] => {
    const seen = new Set<string>();

    for (const raw of values ?? []) {
        const value = lowercase ? raw.trim().toLowerCase() : raw.trim();

        if (value) seen.add(value);
    }

    return [...seen];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Defaults and bounds for each optional parameter, one line each.
// fallow-ignore-next-line complexity
const normalizeQuery = (query: DiscoverySearchQuery): NormalizedDiscoveryQuery => {
    const pageSize = clamp(Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);
    const page = Math.max(Math.trunc(query.page ?? 1), 1);

    if (page * pageSize > MAX_RESULT_WINDOW) {
        throw httpError(`Cannot page past result ${MAX_RESULT_WINDOW}; narrow the search instead`, 400);
    }

    return {
        q: query.q?.trim() || undefined,
        tags: clean(query.tags, true),
        ingredients: clean(query.ingredients),
        difficulty: [...new Set(query.difficulty ?? [])],
        source: [...new Set(query.source ?? [])],
        minTime: query.minTime,
        maxTime: query.maxTime,
        page,
        pageSize,
    };
};

/**
 * Mongo is the system of record for the library; the index is derived from it. Every write goes Mongo first, then the
 * index, so a failed index write leaves a recipe that a reindex repairs rather than one that exists only in search.
 */
export class DiscoveryService {
    constructor(
        private readonly repository: DiscoveryRecipeRepository,
        private readonly index: DiscoveryIndex,
        private readonly logger?: Logger
    ) {}

    async search(query: DiscoverySearchQuery): Promise<DiscoverySearchResult> {
        return this.index.search(normalizeQuery(query));
    }

    async getRecipe(id: string): Promise<DiscoveryRecipe> {
        const recipe = await this.repository.getById(id);

        if (!recipe) throw httpError('Library recipe not found', 404);

        return recipe;
    }

    /** Several recipes in one query; ids that no longer exist are left out rather than failing the lot. */
    // fallow-ignore-next-line unused-class-member
    async getRecipes(ids: string[]): Promise<DiscoveryRecipe[]> {
        return this.repository.getByIds(ids);
    }

    async getSimilar(id: string, limit = DEFAULT_SIMILAR_LIMIT): Promise<DiscoveryRecipeSummary[]> {
        await this.getRecipe(id);

        return this.index.similar(id, clamp(Math.trunc(limit), 1, MAX_SIMILAR_LIMIT));
    }

    /** The write path shared by ingestion and publishing: Mongo, then the index. */
    // fallow-ignore-next-line unused-class-member
    async save(recipe: DiscoveryRecipe): Promise<void> {
        await this.repository.upsert(recipe);
        await this.index.index(recipe);
    }

    // fallow-ignore-next-line unused-class-member
    async remove(id: string): Promise<void> {
        await this.repository.deleteById(id);
        await this.index.remove(id);
    }

    // fallow-ignore-next-line unused-class-member
    async findByTitle(title: string): Promise<DiscoveryRecipe[]> {
        return this.repository.findByTitle(title);
    }

    /** The recipe that has the given public URL slug, or null. */
    async getBySlug(slug: string): Promise<DiscoveryRecipe | null> {
        return this.repository.getBySlug(slug);
    }

    /** Whether a different library recipe already uses `slug`. Used to settle collisions on publish. */
    // fallow-ignore-next-line unused-class-member
    async hasSlug(slug: string): Promise<boolean> {
        return this.repository.hasSlug(slug);
    }

    /** Cursor-paginated public list. Caller encodes the cursor from the previous page's last `_id`. */
    async listPublic(pageSize: number, after: string | null): Promise<DiscoveryRecipe[]> {
        return this.repository.listPublic(pageSize, after);
    }

    /** Whether any library recipe still uses this cover image. */
    // fallow-ignore-next-line unused-class-member
    async hasCoverImageKey(key: string): Promise<boolean> {
        return this.repository.hasCoverImageKey(key);
    }

    /** What a source refresh diffs against: id and source revision of every library recipe from that source. */
    // fallow-ignore-next-line unused-class-member
    async listRevisions(
        source: DiscoverySource
    ): Promise<Array<Pick<DiscoveryRecipe, 'id' | 'sourceRevision' | 'imageRevision' | 'createdAt'>>> {
        return this.repository.listRevisions(source);
    }

    /** Rebuilds the whole search index from Mongo. Safe to run while the API serves traffic. */
    // fallow-ignore-next-line unused-class-member
    async reindex(): Promise<number> {
        const count = await this.index.rebuild(this.repository.batches(REINDEX_BATCH_SIZE));
        this.logger?.info('Discovery index rebuilt from Mongo', { count });

        return count;
    }

    // fallow-ignore-next-line unused-class-member
    async ensureIndex(): Promise<void> {
        await this.index.ensureIndex();
    }
}
