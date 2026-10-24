import type { NormalizedDiscoveryQuery } from '../../domain/DiscoveryService/types';
import { SUMMARY_FIELDS } from './document';

// Title is what a person types; an ingredient hit is a weaker signal; a tag is weaker still.
const TEXT_FIELDS = ['title^3', 'ingredientNames^2', 'tags.text^1'];

const FACET_SIZE = 20;

/** Half-open total-minutes ranges; keys are what the Discover page shows and maps back to minTime/maxTime. */
export const TIME_RANGES = [
    { key: 'under-15', to: 15 },
    { key: '15-30', from: 15, to: 30 },
    { key: '30-60', from: 30, to: 60 },
    { key: '60-120', from: 60, to: 120 },
    { key: 'over-120', from: 120 },
];

// One flat list of optional filters; splitting it would scatter one query.
// fallow-ignore-next-line complexity
const buildFilters = (query: NormalizedDiscoveryQuery): object[] => {
    const filters: object[] = [];
    for (const tag of query.tags) filters.push({ term: { tags: tag } });
    // match_phrase: "olive oil" must be adjacent within one ingredient, but stemming and synonyms still apply.
    for (const ingredient of query.ingredients) filters.push({ match_phrase: { ingredientNames: ingredient } });
    if (query.difficulty.length > 0) filters.push({ terms: { difficulty: query.difficulty } });
    if (query.source.length > 0) filters.push({ terms: { source: query.source } });
    if (query.minTime !== undefined || query.maxTime !== undefined) {
        filters.push({ range: { totalTime: { gte: query.minTime, lte: query.maxTime } } });
    }
    return filters;
};

const buildText = (q: string | undefined): object =>
    q
        ? {
              multi_match: {
                  query: q,
                  fields: TEXT_FIELDS,
                  type: 'best_fields',
                  // Typo tolerance: edit distance scales with term length; the first letter must be right (cheaper, fewer false hits).
                  fuzziness: 'AUTO',
                  prefix_length: 1,
                  tie_breaker: 0.3,
              },
          }
        : { match_all: {} };

export const buildSearchBody = (query: NormalizedDiscoveryQuery) => ({
    from: (query.page - 1) * query.pageSize,
    size: query.pageSize,
    track_total_hits: true,
    _source: [...SUMMARY_FIELDS],
    query: { bool: { must: [buildText(query.q)], filter: buildFilters(query) } },
    // Relevance when there is a text query; newest first when browsing. `id` makes paging deterministic on ties.
    sort: query.q ? ['_score', { id: 'asc' }] : [{ updatedAt: 'desc' }, { id: 'asc' }],
    // Facet counts describe the current result set, so they shrink as filters are applied.
    aggs: {
        tags: { terms: { field: 'tags', size: FACET_SIZE } },
        difficulty: { terms: { field: 'difficulty' } },
        source: { terms: { field: 'source' } },
        ingredients: { terms: { field: 'ingredientNames.keyword', size: FACET_SIZE } },
        time: { range: { field: 'totalTime', ranges: TIME_RANGES } },
    },
});

export const buildSimilarBody = (alias: string, id: string, limit: number) => ({
    size: limit,
    _source: [...SUMMARY_FIELDS],
    query: {
        more_like_this: {
            fields: ['title', 'tags.text', 'ingredientNames'],
            like: [{ _index: alias, _id: id }],
            // A library of a few thousand short documents: the defaults (2 / 5) would discard nearly every term.
            min_term_freq: 1,
            min_doc_freq: 1,
            max_query_terms: 25,
            minimum_should_match: '30%',
        },
    },
});
