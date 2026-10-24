/**
 * Loads the Wikibooks Cookbook into the discovery library and keeps it in step with the wiki.
 * The first run is a full load; later runs only reprocess pages whose wiki revision changed, and remove recipes whose
 * page was deleted. Re-running is always safe: recipes are keyed by wiki page id, so nothing is duplicated.
 * A page that fails is logged and left for the next run; it never aborts the run.
 * Cover pictures are fetched from Wikimedia only where the picture's licence allows reuse, and credited; recipes loaded
 * before covers existed get theirs on the next run without being rebuilt.
 *
 *   bun run discover:ingest              (from the repo root, reads .env)
 *   bun run discover:ingest -- --limit 25   process at most 25 new/changed pages (trial run)
 */
import 'dotenv/config';

import { config } from '../src/config';
import { dependencyContainer, registerDepdendencies } from '../src/dependencies';
import { DependencyToken } from '../src/dependencies/types';
import { backfillWikibooksSlugs } from '../src/migrations/wikibooksSlugs';

registerDepdendencies();

if (!config.get('opensearchUrl')) {
    console.error('OPENSEARCH_URL is not set; the library cannot be indexed.');
    process.exit(1);
}
if (!(config.get('falKey') || config.get('recipeImportLlmApiKey'))) {
    console.error('FAL_KEY is not set; recipes cannot be tagged.');
    process.exit(1);
}

const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex === -1 ? undefined : Number(process.argv[limitIndex + 1]);
if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
    console.error('--limit needs a positive whole number.');
    process.exit(1);
}

const database = dependencyContainer.resolve(DependencyToken.Database);
await database.connect({ connectionUri: config.get('connectionUri'), databaseName: config.get('databaseName') });
await dependencyContainer.resolve(DependencyToken.Bucket).connect?.({
    endpoint: config.get('bucketEndpoint'),
    accessKey: config.get('bucketAccessKey'),
    secretKey: config.get('bucketSecretKey'),
    bucketName: config.get('bucketName'),
});
const discoveryRecipes = dependencyContainer.resolve(DependencyToken.DiscoveryRecipeRepository);
await discoveryRecipes.ensureIndexes();
// Unchanged pages are not rewritten below, so ones stored before slugs existed get theirs here.
await backfillWikibooksSlugs(discoveryRecipes, dependencyContainer.resolve(DependencyToken.Logger));
await dependencyContainer.resolve(DependencyToken.DiscoveryService).ensureIndex();

const summary = await dependencyContainer.resolve(DependencyToken.WikibooksIngestService).run({ limit });
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.failed > 0 || summary.coversFailed > 0 || summary.removalsBlocked > 0 ? 2 : 0);
