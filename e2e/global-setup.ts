import { MongoClient, ObjectId } from 'mongodb';
import { E2E_OPENSEARCH_URL, seedDiscoveryLibrary } from './db-helpers';
import { DISCOVERY_FIXTURES } from './discovery-fixtures';
import { MOCK_USER, MOCK_USER_2, PASSWORDS } from './mocks/data/users';
import { resolveMongoUri } from './mongo-uri';
import { allStacks } from './stack';

const STACKS = allStacks();

// Writes the two fixture accounts in the shape Better Auth's Mongo adapter stores (user + credential
// account), with fixed ids so specs can name them. Upserts, so a run that died before teardown is harmless.
const seedUsers = async (client: MongoClient, dbName: string) => {
    const db = client.db(dbName);
    const now = new Date();
    for (const user of [MOCK_USER, MOCK_USER_2]) {
        const _id = new ObjectId(user.id);
        await db.collection('user').replaceOne(
            { _id },
            {
                name: user.username,
                email: `${user.id}@users.invalid`,
                emailVerified: false,
                username: user.username.toLowerCase(),
                displayUsername: user.username,
                createdAt: now,
                updatedAt: now,
            },
            { upsert: true }
        );
        await db.collection('account').replaceOne(
            { userId: _id, providerId: 'credential' },
            {
                userId: _id,
                providerId: 'credential',
                accountId: user.id,
                password: await Bun.password.hash(PASSWORDS[user.username], { algorithm: 'argon2id' }),
                createdAt: now,
                updatedAt: now,
            },
            { upsert: true }
        );
    }
};

export default async function globalSetup(): Promise<() => Promise<void>> {
    const client = new MongoClient(resolveMongoUri());
    try {
        await client.connect();
        for (const stack of STACKS) await seedUsers(client, stack.dbName);
    } finally {
        await client.close();
    }

    // Discover specs only read the library (discover-publish puts it back after each test), so it is seeded once per
    // stack rather than per test.
    if (E2E_OPENSEARCH_URL) await seedDiscoveryLibrary(DISCOVERY_FIXTURES, STACKS);

    return async () => {
        // Empty the library before the database is dropped so the index is not left holding fixtures.
        if (E2E_OPENSEARCH_URL) await seedDiscoveryLibrary([], STACKS);

        const teardown = new MongoClient(resolveMongoUri());
        try {
            await teardown.connect();
            for (const stack of STACKS) await teardown.db(stack.dbName).dropDatabase();
        } finally {
            await teardown.close();
        }
    };
}
