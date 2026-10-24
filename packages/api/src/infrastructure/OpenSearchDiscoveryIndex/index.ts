import type { Logger } from '@imapps/api-utils';
import { errors } from '@opensearch-project/opensearch';
import type {
    DiscoveryFacetBucket,
    DiscoveryFacets,
    DiscoveryRecipe,
    DiscoveryRecipeSummary,
    DiscoverySearchResult,
    DiscoveryTimeBucket,
} from '@tandra/types';

import type { DiscoveryIndex, NormalizedDiscoveryQuery } from '../../domain/DiscoveryService/types';
import { toIndexDocument, toSummary } from './document';
import { DEFAULT_INDEX_ALIAS, indexBody } from './mapping';
import { buildSearchBody, buildSimilarBody, TIME_RANGES } from './query';

type Reply<T = unknown> = Promise<{ body: T }>;
type Options = { ignore?: number[] };

/**
 * The slice of the OpenSearch client this index uses. The real client is far more strictly typed than the plain JSON
 * bodies built here need; declaring the slice keeps the call sites honest and lets tests pass a fake.
 */
export interface OpenSearchApi {
    indices: {
        existsAlias(params: { name: string }): Reply<boolean>;
        create(params: { index: string; body: object }): Reply;
        delete(params: { index: string }, options?: Options): Reply;
        refresh(params: { index: string }): Reply;
        getAlias(params: { name: string }, options?: Options): Reply<Record<string, unknown>>;
        updateAliases(params: { body: object }): Reply;
    };
    index(params: { index: string; id: string; body: object }): Reply;
    delete(params: { index: string; id: string }, options?: Options): Reply;
    search<T>(params: { index: string; body: object }): Reply<T>;
    bulk(params: { body: object[] }): Reply<{ errors: boolean; items: Array<{ index?: { error?: unknown } }> }>;
}

const unavailable = (message: string, cause?: unknown) => Object.assign(new Error(message), { status: 503, cause });

/** Failures that mean "the engine is not there", as opposed to "we sent it something wrong". */
// A flat list of error classes that mean "engine unreachable".
// fallow-ignore-next-line complexity
const isUnreachable = (error: unknown): boolean =>
    error instanceof errors.ConnectionError ||
    error instanceof errors.TimeoutError ||
    error instanceof errors.NoLivingConnectionsError ||
    (error instanceof errors.ResponseError && (error.statusCode === 503 || error.statusCode === 502));

type Bucket = { key: string | number; doc_count: number };
type SearchResponse = {
    hits: { total: { value: number }; hits: Array<{ _source: Record<string, unknown> }> };
    aggregations?: Record<string, { buckets: Bucket[] }>;
};

const toBuckets = (buckets: Bucket[] | undefined): DiscoveryFacetBucket[] =>
    (buckets ?? []).map((b) => ({ key: String(b.key), count: b.doc_count }));

// Range aggregations return every configured bucket, including empty ones; keep them so the page can show 0 counts.
const toTimeBuckets = (buckets: Bucket[] | undefined): DiscoveryTimeBucket[] =>
    TIME_RANGES.map((range) => {
        const found = buckets?.find((b) => b.key === range.key);
        return { key: range.key, count: found?.doc_count ?? 0, from: range.from, to: range.to };
    });

// One line per facet.
// fallow-ignore-next-line complexity
const toFacets = (aggregations: SearchResponse['aggregations']): DiscoveryFacets => ({
    tags: toBuckets(aggregations?.tags?.buckets),
    difficulty: toBuckets(aggregations?.difficulty?.buckets),
    source: toBuckets(aggregations?.source?.buckets),
    ingredients: toBuckets(aggregations?.ingredients?.buckets),
    time: toTimeBuckets(aggregations?.time?.buckets),
});

export class OpenSearchDiscoveryIndex implements DiscoveryIndex {
    private ready: Promise<void> | null = null;

    /** `null` when OPENSEARCH_URL is not configured: every call then fails with a 503 and nothing else is affected. */
    constructor(
        private readonly client: OpenSearchApi | null,
        private readonly logger?: Logger,
        /** Read/write alias; several API instances (e.g. e2e workers) can share one engine under different aliases. */
        private readonly alias: string = DEFAULT_INDEX_ALIAS
    ) {}

    /** Runs `fn` once the index exists, turning "engine unreachable" into a 503 instead of a 500. */
    private async guarded<T>(fn: (client: OpenSearchApi) => Promise<T>): Promise<T> {
        const client = this.client;
        if (!client) throw unavailable('Recipe discovery is not configured');
        try {
            await this.ensureIndex();
            return await fn(client);
        } catch (error) {
            if (isUnreachable(error)) {
                this.logger?.warn('Discovery search engine unreachable', { error: (error as Error).message });
                throw unavailable('Recipe discovery is temporarily unavailable', error);
            }
            throw error;
        }
    }

    /** Memoised on success only, so an engine that was down at startup is picked up on the next request. */
    ensureIndex(): Promise<void> {
        const client = this.client;
        if (!client) return Promise.reject(unavailable('Recipe discovery is not configured'));
        if (!this.ready) {
            this.ready = this.createIfMissing(client).catch((error) => {
                this.ready = null;
                throw error;
            });
        }
        return this.ready;
    }

    // Check, create, and tolerate losing the creation race: one sequence.
    // fallow-ignore-next-line complexity
    private async createIfMissing(client: OpenSearchApi): Promise<void> {
        const { body: exists } = await client.indices.existsAlias({ name: this.alias });
        if (exists) return;
        const initial = `${this.alias}-000001`;
        try {
            await client.indices.create({
                index: initial,
                body: { ...indexBody, aliases: { [this.alias]: {} } },
            });
            this.logger?.info('Created discovery index', { index: initial });
        } catch (error) {
            // Another API instance won the race to create it; that is the outcome we wanted.
            if (
                !(
                    error instanceof errors.ResponseError &&
                    (error.body as { error?: { type?: string } } | undefined)?.error?.type ===
                        'resource_already_exists_exception'
                )
            ) {
                throw error;
            }
        }
    }

    async index(recipe: DiscoveryRecipe): Promise<void> {
        await this.guarded((client) =>
            client.index({ index: this.alias, id: recipe.id, body: toIndexDocument(recipe) })
        );
    }

    async remove(id: string): Promise<void> {
        await this.guarded((client) => client.delete({ index: this.alias, id }, { ignore: [404] }));
    }

    async search(query: NormalizedDiscoveryQuery): Promise<DiscoverySearchResult> {
        const { body } = await this.guarded((client) =>
            client.search<SearchResponse>({ index: this.alias, body: buildSearchBody(query) })
        );
        return {
            hits: body.hits.hits.map((hit) => toSummary(hit._source)),
            total: body.hits.total.value,
            page: query.page,
            pageSize: query.pageSize,
            facets: toFacets(body.aggregations),
        };
    }

    async similar(id: string, limit: number): Promise<DiscoveryRecipeSummary[]> {
        const { body } = await this.guarded((client) =>
            client.search<SearchResponse>({ index: this.alias, body: buildSimilarBody(this.alias, id, limit) })
        );
        return body.hits.hits.map((hit) => toSummary(hit._source));
    }

    async rebuild(batches: AsyncIterable<DiscoveryRecipe[]>): Promise<number> {
        return this.guarded(async (client) => {
            const next = `${this.alias}-${Date.now()}`;
            await client.indices.create({ index: next, body: indexBody });
            try {
                const count = await this.load(client, next, batches);
                await client.indices.refresh({ index: next });
                await this.swapAlias(client, next);
                return count;
            } catch (error) {
                await client.indices.delete({ index: next }, { ignore: [404] });
                throw error;
            }
        });
    }

    private async load(
        client: OpenSearchApi,
        index: string,
        batches: AsyncIterable<DiscoveryRecipe[]>
    ): Promise<number> {
        let count = 0;
        for await (const batch of batches) {
            const operations = batch.flatMap((recipe) => [
                { index: { _index: index, _id: recipe.id } },
                toIndexDocument(recipe),
            ]);
            const { body } = await client.bulk({ body: operations });
            if (body.errors) {
                const failed = body.items.find((item) => item.index?.error);
                throw new Error(`Bulk indexing failed: ${JSON.stringify(failed?.index?.error)}`);
            }
            count += batch.length;
        }
        return count;
    }

    /** One atomic alias update: readers see the old index or the new one, never neither. */
    private async swapAlias(client: OpenSearchApi, next: string): Promise<void> {
        const { body: current } = await client.indices.getAlias({ name: this.alias }, { ignore: [404] });
        const previous = Object.keys(current && !('error' in current) ? current : {});
        await client.indices.updateAliases({
            body: {
                actions: [
                    ...previous.map((index) => ({ remove: { index, alias: this.alias } })),
                    { add: { index: next, alias: this.alias } },
                ],
            },
        });
        for (const index of previous) {
            await client.indices.delete({ index }, { ignore: [404] });
        }
    }
}
