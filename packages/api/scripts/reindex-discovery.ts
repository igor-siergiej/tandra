/**
 * Rebuilds the OpenSearch discovery index from the `discoveryRecipes` Mongo collection.
 * Safe to run against a live API: the new index is built aside and swapped in with one atomic alias update.
 *
 *   bun run reindex:discovery        (from the repo root, reads .env)
 */
import 'dotenv/config';
import { config } from '../src/config';
import { dependencyContainer, registerDepdendencies } from '../src/dependencies';
import { DependencyToken } from '../src/dependencies/types';

registerDepdendencies();

if (!config.get('opensearchUrl')) {
    console.error('OPENSEARCH_URL is not set; nothing to reindex into.');
    process.exit(1);
}

const database = dependencyContainer.resolve(DependencyToken.Database);

await database.connect({ connectionUri: config.get('connectionUri'), databaseName: config.get('databaseName') });

const count = await dependencyContainer.resolve(DependencyToken.DiscoveryService).reindex();

console.log(`Reindexed ${count} library recipes.`);

process.exit(0);
