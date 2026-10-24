import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DiscoveryRecipe, User } from '@tandra/types';
import { MongoClient } from 'mongodb';
import { resolveMongoUri } from './mongo-uri';
import { currentStack, type Stack } from './stack';

const DB_NAME = currentStack.dbName;

/** Canonical sorted pair — mirrors the API's canonicalPair. */
const sortPair = (a: User, b: User): { userIds: [string, string]; users: [User, User] } =>
    a.id < b.id ? { userIds: [a.id, b.id], users: [a, b] } : { userIds: [b.id, a.id], users: [b, a] };

/**
 * Seed a mutual friendship directly into Mongo. Sharing now requires the two
 * users to be friends, so e2e sharing tests establish the friendship this way
 * (there is no single-token API path to pair two distinct users).
 */
export async function seedFriendship(a: User, b: User): Promise<void> {
    const client = new MongoClient(resolveMongoUri());
    await client.connect();
    try {
        const { userIds, users } = sortPair(a, b);
        await client
            .db(DB_NAME)
            .collection('friendships')
            .updateOne(
                { userIds },
                { $setOnInsert: { id: `friendship-${userIds.join('-')}`, userIds, users, createdAt: new Date() } },
                { upsert: true }
            );
    } finally {
        await client.close();
    }
}

const run = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Where the e2e API's discovery index lives. Unset means "no OpenSearch for this run": Discover specs skip.
 * Deliberately NOT `OPENSEARCH_URL`: a developer's .env points that at a real index, and the e2e library must
 * never be written into it.
 */
export const E2E_OPENSEARCH_URL = process.env.E2E_OPENSEARCH_URL;

/** Rebuilds a stack's OpenSearch discovery index from its e2e Mongo library, through the API's own reindex command. */
async function reindexDiscovery(stack: Stack): Promise<void> {
    await run('bun', ['packages/api/scripts/reindex-discovery.ts'], {
        cwd: REPO_ROOT,
        env: {
            ...process.env,
            PORT: '0',
            CONNECTION_URI: resolveMongoUri(),
            DATABASE_NAME: stack.dbName,
            OPENSEARCH_URL: E2E_OPENSEARCH_URL,
            OPENSEARCH_INDEX: stack.discoveryIndex,
            BUCKET_ENDPOINT: 'localhost:9000',
            BUCKET_NAME: 'tandra',
            BUCKET_ACCESS_KEY: 'rustfsadmin',
            BUCKET_SECRET_KEY: 'rustfsadmin',
            // The API config requires these even though reindexing never touches auth.
            BETTER_AUTH_SECRET: 'e2e-better-auth-secret-not-for-prod-32+',
            BETTER_AUTH_URL: stack.webOrigin,
        },
    });
}

/** Replaces the e2e discovery library (Mongo, then the index) of each of `stacks` with exactly `recipes`. */
export async function seedDiscoveryLibrary(
    recipes: DiscoveryRecipe[],
    stacks: Stack[] = [currentStack]
): Promise<void> {
    const client = new MongoClient(resolveMongoUri());
    await client.connect();
    try {
        for (const stack of stacks) {
            const collection = client.db(stack.dbName).collection('discoveryRecipes');
            await collection.deleteMany({});
            if (recipes.length > 0) await collection.insertMany(recipes.map((recipe) => ({ ...recipe })));
        }
    } finally {
        await client.close();
    }
    await Promise.all(stacks.map(reindexDiscovery));
}

/** Sets image keys on a recipe directly; the API only writes these after a real object-store upload or AI generation. */
export async function seedRecipeImageKeys(
    recipeId: string,
    keys: { coverImageKey?: string; aiImageKey?: string }
): Promise<void> {
    const client = new MongoClient(resolveMongoUri());
    await client.connect();
    try {
        await client.db(DB_NAME).collection('recipe').updateOne({ id: recipeId }, { $set: keys });
    } finally {
        await client.close();
    }
}

/** Makes every outstanding friend invite code already expired. */
export async function expireFriendCodes(): Promise<void> {
    const client = new MongoClient(resolveMongoUri());
    await client.connect();
    try {
        await client
            .db(DB_NAME)
            .collection('pairingCodes')
            .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
    } finally {
        await client.close();
    }
}
