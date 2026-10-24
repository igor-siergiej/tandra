# Recipe discovery search

Search over the shared recipe library (`discoveryRecipes`). Personal recipes are not involved: they stay in the
`recipe` collection and keep using Fuse.js in the browser.

## Architecture

```
ingest / publish ──► DiscoveryService.save ──► Mongo `discoveryRecipes`   (system of record)
                                          └──► OpenSearch index           (derived, rebuildable)
GET /api/discover/* ──► DiscoveryService ──► OpenSearch (search, similar) / Mongo (full recipe)
```

- Mongo is the only place anything is stored. Lose the OpenSearch volume and `bun run reindex:discovery` rebuilds it.
- Writes go Mongo first, then the index. A failed index write leaves a recipe the next reindex repairs, never one that
  exists only in search.
- Search hits are summaries (title, tags, times, difficulty, cover, source). The full recipe comes from
  `GET /api/discover/recipes/:id`, which reads Mongo.
- `OPENSEARCH_URL` unset or the engine unreachable: every `/api/discover/*` route answers `503` with a plain message.
  Nothing else in the API depends on it. The index is created lazily, so an engine that was down at boot is picked up
  by the first request that can reach it.

## Index layout

`discovery-recipes` is an **alias**. The concrete index behind it is `discovery-recipes-000001` on first start and
`discovery-recipes-<timestamp>` after a reindex. Readers and writers only use the alias.

`dynamic: strict`: a document with a field the mapping does not know is rejected rather than silently mapped, so a typo
in the indexing code fails loudly in tests.

| Field | Mapping | Why |
| --- | --- | --- |
| `title` | `text` (`recipe_text` / `recipe_search`) + `.keyword` | Full-text matching; the keyword subfield is for exact/sort use |
| `ingredientNames` | `text`, `position_increment_gap: 100` + `.keyword` | One entry per ingredient. The gap stops a phrase such as "olive oil" matching "olive" in one ingredient and "oil" in the next. `.keyword` feeds the ingredient facet |
| `tags` | `keyword` (folded normalizer) + `.text` | Exact filter and facet on the keyword; `.text` so tags also score in free-text search |
| `prepTime`, `cookTime`, `totalTime`, `servings` | `integer` | `totalTime` = prep + cook, derived at index time so time filters and the time facet are plain range queries. Absent when the recipe has no time at all |
| `difficulty`, `source`, `estimated` | `keyword` | Filters and facets |
| `coverImageKey` | `keyword`, `index: false` | Returned, never searched |
| `createdAt`, `updatedAt` | `date` | Browse order |

Instructions and ingredient quantities are **not** indexed; they live only in Mongo.

## Analysis

- `recipe_text` (index time): `standard` tokenizer → `lowercase` → `asciifolding` → `english` stemmer.
  "Jalapeño" and "jalapeno" meet, and "tomatoes" meets "tomato".
- `recipe_search` (query time): the same chain with a `synonym_graph` filter **before** the stemmer, so both sides of a
  synonym stem identically. Synonyms apply at query time only, so changing the list never changes what was indexed. The
  list itself lives in the index settings, so an existing index picks up edits to `mapping.ts` through a reindex.
- Synonym groups cover the British/American ingredient names that make a search miss: aubergine/eggplant,
  coriander/cilantro, courgette/zucchini, prawn/shrimp, and so on (`INGREDIENT_SYNONYMS` in `mapping.ts`).
- `keyword_folded` normalizer (lowercase + asciifolding) on keyword fields: tag and facet matching is case- and
  accent-insensitive.

## Querying

`GET /api/discover/recipes`

| Param | Meaning |
| --- | --- |
| `q` | Free text. Empty browses the library newest-first |
| `tags` | Must carry **all** listed tags (repeat the param or comma-separate) |
| `ingredients` | Must contain **all** listed ingredients, each as a phrase, stemmed and synonym-aware. Repeat the param; commas are NOT separators, because names contain them ("onion, chopped") |
| `difficulty`, `source` | Any-of (`easy,medium,hard`; `wikibooks,user`) |
| `minTime`, `maxTime` | Inclusive bounds on total minutes. Recipes with no time never match a time bound |
| `page`, `pageSize` | 1-based; page size capped at 50; results past 10,000 are refused with `400` |

Text search is a `multi_match` (`best_fields`, `tie_breaker 0.3`) over `title^3`, `ingredientNames^2`, `tags.text^1`
with `fuzziness: AUTO` and `prefix_length: 1`: typos within 1-2 edits still match, but the first letter must be right.
The boosts are verified by a ranking test that makes the *short* fields (tag, ingredient) lose to a *long* title, which
only passes because of the boosts; unboosted BM25 favours the short fields.

Facets (`facets` in the response) are aggregations over the **filtered** result set, so counts shrink as filters are
applied: `tags` and `ingredients` (top 20 terms), `difficulty`, `source`, and `time` ranges
(`under-15`, `15-30`, `30-60`, `60-120`, `over-120`; lower bound inclusive, upper exclusive). A consequence worth
knowing: selecting one difficulty hides the counts for the others. Showing sibling counts would need `post_filter` plus
per-facet filter aggregations; not done because no consumer needs it yet.

`GET /api/discover/recipes/:id/similar?limit=` uses `more_like_this` over `title`, `tags.text` and `ingredientNames`
(`min_term_freq`/`min_doc_freq` 1, because the library is a few thousand short documents and the defaults would discard
nearly every term). It does not expand synonyms, and never returns the recipe itself.

## Reindexing

```bash
bun run reindex:discovery      # reads .env; needs CONNECTION_URI and OPENSEARCH_URL
```

Builds a fresh `discovery-recipes-<timestamp>` from Mongo in batches of 500, refreshes it, swaps the alias in one atomic
`_aliases` call, then deletes the old index. Readers see the old index or the new one, never neither. If the Mongo read
or a bulk item fails, the half-built index is deleted and the live one is untouched. `OPENSEARCH_INDEX` replaces the
`discovery-recipes` alias (and the index names derived from it), so several APIs can share one engine; the e2e suite
gives each Playwright worker its own.

## Running it locally

```bash
docker run -d --name opensearch -p 127.0.0.1:9200:9200 \
  -e discovery.type=single-node -e DISABLE_SECURITY_PLUGIN=true -e DISABLE_INSTALL_DEMO_CONFIG=true \
  -e OPENSEARCH_JAVA_OPTS="-Xms1g -Xmx1g" --memory 2g opensearchproject/opensearch:2.19.1

# .env
OPENSEARCH_URL=http://localhost:9200

# integration tests (real OpenSearch). Dedicated variable: the suite deletes every `discovery-recipes*` index it finds.
OPENSEARCH_TEST_URL=http://localhost:9200 bun run --filter @tandra/api test
```

Without `OPENSEARCH_TEST_URL` the integration suite is skipped and the unit tests still run. A 512 MB heap in a 1 GB
container was OOM-killed under the suite's create/delete-index churn; 1 GB heap in a 2 GB container, the production
budget, was stable.

## Deployment

Single-node OpenSearch on the Dokploy host, internal Docker network only (no published port), `-Xms1g -Xmx1g`, container
memory limit 2 GB, data on a named volume. The compose file lives in the `foundry` repo (`opensearch/docker-compose.yml`).
The API reaches it by service name: set `OPENSEARCH_URL=http://opensearch:9200` on the tandra API application.
OpenSearch was chosen over Meilisearch/Typesense deliberately, partly to learn analyzers, mappings, aggregations and
relevance tuning; the cost is roughly 2 GB of RAM.
