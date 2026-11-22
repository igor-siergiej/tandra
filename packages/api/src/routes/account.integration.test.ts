/**
 * DELETE /api/account against the real app: the real Hono routes and Better Auth on a real Mongo database, with an
 * in-memory S3 server standing in for RustFS and a stub for OpenSearch (both are only reached over the network, so
 * the test never depends on what the cascade calls them with). Skipped when no Mongo answers on MONGO_TEST_URI
 * (default: CONNECTION_URI in the root .env, else mongodb://localhost:27017); the test works in a database of its own and drops it afterwards.
 *
 *   MONGO_TEST_URI=mongodb://localhost:27017 bun test account.integration
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Server } from 'bun';
import { parse } from 'dotenv';
import { type Db, type Document, MongoClient, ObjectId } from 'mongodb';

// The test preload overwrites CONNECTION_URI, so a developer's credentials come from MONGO_TEST_URI or the root
// .env (the same file `bun run test:e2e` reads), with the database name left to this test.
const rootEnv = join(import.meta.dir, '../../../../.env');

const mongoUriFromEnvFile = (): string | undefined => {
    const uri = existsSync(rootEnv) ? parse(readFileSync(rootEnv)).CONNECTION_URI : undefined;

    if (!uri) return undefined;
    const url = new URL(uri);
    url.pathname = '/';

    return url.toString();
};

const MONGO_URI = process.env.MONGO_TEST_URI ?? mongoUriFromEnvFile() ?? 'mongodb://localhost:27017';
const DB_NAME = `tandra_account_delete_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const BUCKET = 'tandra-test';
const PASSWORD = 'correct-horse-battery';

const mongoReachable = async (): Promise<boolean> => {
    const probe = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 1500 });

    try {
        await probe.connect();
        // listCollections needs the credentials to be valid, which a bare ping does not.
        await probe.db(DB_NAME).command({ listCollections: 1 });

        return true;
    } catch {
        return false;
    } finally {
        await probe.close().catch((): void => undefined);
    }
};

const mongoUp = await mongoReachable();

// ---------------------------------------------------------------------------------------------------------------
// An S3-compatible server in memory: the object calls the minio client makes (put, get, head, delete, multi-delete,
// list), so any way the API chooses to remove a key ends up in `objects`.
// ---------------------------------------------------------------------------------------------------------------

interface StoredObject {
    body: Buffer;
    contentType: string;
}

const objects = new Map<string, StoredObject>();

const xml = (body: string, status = 200) =>
    new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
        status,
        headers: { 'Content-Type': 'application/xml' },
    });

const objectHeaders = (object: StoredObject) => ({
    'Content-Type': object.contentType,
    'Content-Length': String(object.body.length),
    ETag: '"etag"',
    'Last-Modified': new Date().toUTCString(),
});

const s3Handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const [, bucket, ...rest] = url.pathname.split('/');
    const key = decodeURIComponent(rest.join('/'));

    if (!bucket) {
        return xml('<ListAllMyBucketsResult><Buckets></Buckets></ListAllMyBucketsResult>');
    }

    if (!key) {
        if (url.searchParams.has('location')) return xml('<LocationConstraint>us-east-1</LocationConstraint>');

        if (request.method === 'POST' && url.searchParams.has('delete')) {
            const text = await request.text();

            for (const match of text.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
                objects.delete(match[1].replaceAll('&amp;', '&'));
            }

            return xml('<DeleteResult></DeleteResult>');
        }

        if (request.method === 'GET') {
            const prefix = url.searchParams.get('prefix') ?? '';

            const contents = [...objects.entries()]
                .filter(([name]) => name.startsWith(prefix))
                .map(
                    ([name, object]) =>
                        `<Contents><Key>${encodeURIComponent(name)}</Key><LastModified>${new Date().toISOString()}</LastModified><ETag>"etag"</ETag><Size>${object.body.length}</Size></Contents>`
                )
                .join('');

            return xml(
                `<ListBucketResult><Name>${bucket}</Name><Prefix>${prefix}</Prefix><KeyCount>${objects.size}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><EncodingType>url</EncodingType>${contents}</ListBucketResult>`
            );
        }

        return new Response(null, { status: 200 });
    }

    if (request.method === 'PUT') {
        objects.set(key, {
            body: Buffer.from(await request.arrayBuffer()),
            contentType: request.headers.get('content-type') ?? 'application/octet-stream',
        });

        return new Response(null, { status: 200, headers: { ETag: '"etag"' } });
    }

    if (request.method === 'DELETE') {
        objects.delete(key);

        return new Response(null, { status: 204 });
    }

    const object = objects.get(key);

    if (!object) {
        return xml(`<Error><Code>NoSuchKey</Code><Message>missing</Message><Key>${key}</Key></Error>`, 404);
    }

    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: objectHeaders(object) });

    return new Response(new Uint8Array(object.body), { status: 200, headers: objectHeaders(object) });
};

// ---------------------------------------------------------------------------------------------------------------

const freePort = (): number => {
    const probe = Bun.serve({ port: 0, fetch: () => new Response('') });
    const { port } = probe;
    void probe.stop(true);

    return port as number;
};

let apiBase = '';
let origin = '';
let mongo: MongoClient;
let db: Db;
let s3: Server<undefined>;
let searchStub: Server<undefined>;

let clientCounter = 0;

const nextClientIp = () => {
    clientCounter += 1;

    return `10.1.${(clientCounter >> 8) & 255}.${clientCounter & 255}`;
};

interface Account {
    id: string;
    username: string;
    cookie: string;
}

const call = (as: Pick<Account, 'cookie'> | null, method: string, path: string, body?: unknown) =>
    fetch(`${apiBase}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            'X-Forwarded-For': nextClientIp(),
            ...(as && { Cookie: as.cookie }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

const must = async (response: Response, what: string): Promise<unknown> => {
    if (!response.ok) throw new Error(`${what} failed: ${response.status} ${await response.text()}`);

    return response.status === 204 ? undefined : response.json();
};

const register = async (username: string): Promise<Account> => {
    const response = await call(null, 'POST', '/api/auth/sign-up/email', {
        username,
        password: PASSWORD,
        email: `${username}@example.invalid`,
        name: username,
    });

    const { user } = (await must(response, `sign up ${username}`)) as { user: { id: string } };

    const cookie = response.headers
        .getSetCookie()
        .map((line) => line.split(';')[0])
        .find((pair) => pair.startsWith('better-auth.session_token='));

    if (!cookie) throw new Error(`sign up ${username} set no session cookie`);

    return { id: user.id, username, cookie };
};

const befriend = async (a: Account, b: Account) => {
    const { code } = (await must(await call(a, 'POST', '/api/friends/code'), 'friend code')) as { code: string };
    await must(await call(b, 'POST', '/api/friends/redeem', { code }), 'redeem code');
};

const putObject = (key: string) => objects.set(key, { body: Buffer.from(`image:${key}`), contentType: 'image/webp' });

const addList = async (as: Account, title: string, shareWith: Account[], items: string[]) => {
    await must(
        await call(as, 'PUT', '/api/lists', {
            title,
            listType: 'shopping',
            selectedUsers: shareWith.map((member) => member.id),
            dateAdded: new Date().toISOString(),
        }),
        `create list ${title}`
    );

    for (const itemName of items) {
        await must(
            await call(as, 'PUT', `/api/lists/${encodeURIComponent(title)}/items`, {
                itemName,
                dateAdded: new Date().toISOString(),
            }),
            `add ${itemName}`
        );
    }
};

const addRecipe = async (as: Account, title: string, shareWith: Account[], ingredient: string) => {
    const recipe = (await must(
        await call(as, 'PUT', '/api/recipes', {
            title,
            ingredients: [{ name: ingredient, quantity: 2, unit: 'g' }],
            instructions: ['Combine everything.', 'Simmer gently.'],
            selectedUsers: shareWith.map((member) => member.id),
        }),
        `create recipe ${title}`
    )) as { id: string };

    const coverImageKey = `recipe-upload/${as.id}/${recipe.id}/1700000000000.webp`;
    putObject(coverImageKey);
    await must(await call(as, 'PUT', `/api/recipes/${recipe.id}/image`, { imageKey: coverImageKey }), 'set cover');

    return { id: recipe.id, coverImageKey };
};

const today = new Date().toISOString().slice(0, 10);

interface Seeded {
    doomed: Account;
    survivor: Account;
    survivorListTitle: string;
    survivorRecipeTitle: string;
    survivorTodoTitle: string;
    doomedRecipe: { id: string; coverImageKey: string };
    survivorRecipe: { id: string; coverImageKey: string };
    doomedAiKey: string;
    publishedLibraryId: string;
    survivorLibraryId: string;
}

const hasUser = (id: string) => ({ 'users.id': id });

let seeded = 0;

/** Everything one user can own or be a member of, plus a second user whose data must be left alone. */
const seedWorld = async (doomedName: string, survivorName: string): Promise<Seeded> => {
    const doomed = await register(doomedName);
    const survivor = await register(survivorName);
    await befriend(doomed, survivor);
    // An unredeemed pairing code for each of them.
    await must(await call(doomed, 'POST', '/api/friends/code'), 'doomed code');
    await must(await call(survivor, 'POST', '/api/friends/code'), 'survivor code');

    await addList(doomed, `${doomedName} groceries`, [survivor], ['milk', 'eggs']);
    await addList(survivor, `${survivorName} groceries`, [doomed], ['bread']);
    // The deleted user wrote into the survivor's list: that content stays.
    await must(
        await call(doomed, 'PUT', `/api/lists/${encodeURIComponent(`${survivorName} groceries`)}/items`, {
            itemName: 'butter',
            dateAdded: new Date().toISOString(),
        }),
        'doomed adds to the survivor list'
    );

    // Titles that do not contain a username, so a public attribution can be checked for the name alone.
    seeded += 1;
    const doomedRecipe = await addRecipe(doomed, `Carrot soup ${seeded}`, [survivor], 'carrot');
    const survivorRecipe = await addRecipe(survivor, `Lentil stew ${seeded}`, [doomed], 'lentil');
    const doomedAiKey = `recipe-image/${doomedRecipe.id}.webp`;
    putObject(doomedAiKey);
    await db.collection('recipe').updateOne({ id: doomedRecipe.id }, { $set: { aiImageKey: doomedAiKey } });

    // Discover: the deleted user publishes one recipe and reports the survivor's, and the survivor publishes one.
    const published = (await must(
        await call(doomed, 'POST', `/api/recipes/${doomedRecipe.id}/publish`, { agreeToLicence: true, showName: true }),
        'publish doomed recipe'
    )) as { libraryId: string };

    const survivorPublished = (await must(
        await call(survivor, 'POST', `/api/recipes/${survivorRecipe.id}/publish`, { agreeToLicence: true }),
        'publish survivor recipe'
    )) as { libraryId: string };

    await must(
        await call(doomed, 'POST', `/api/discover/recipes/${survivorPublished.libraryId}/report`, { reason: 'spam' }),
        'report'
    );

    await must(
        await call(doomed, 'PUT', '/api/todos', {
            title: `${doomedName} todo`,
            dueDate: today,
            userIds: [survivor.id],
        }),
        'doomed todo'
    );
    await must(
        await call(survivor, 'PUT', '/api/todos', { title: `${survivorName} todo`, userIds: [doomed.id] }),
        'todo'
    );
    await must(await call(doomed, 'PUT', '/api/labels', { name: `${doomedName} label`, color: '#ff0000' }), 'label');
    await must(
        await call(survivor, 'PUT', '/api/labels', { name: `${survivorName} label`, color: '#00ff00' }),
        'label'
    );

    await must(
        await call(doomed, 'PUT', '/api/meal-plan', {
            date: today,
            recipeId: doomedRecipe.id,
            servings: 2,
            userIds: [survivor.id],
        }),
        'doomed meal plan'
    );

    await must(
        await call(survivor, 'PUT', '/api/meal-plan', {
            date: today,
            recipeId: survivorRecipe.id,
            servings: 4,
            userIds: [doomed.id],
        }),
        'survivor meal plan'
    );

    for (const who of [doomed, survivor]) {
        await must(
            await call(who, 'POST', '/api/push/subscribe', {
                endpoint: `https://push.example.invalid/${who.username}`,
                keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
            }),
            `push ${who.username}`
        );
    }

    // Cached aisle for an item name: keyed by name, with no owner, so there is nothing of the user's to remove.
    await db
        .collection('itemCategories')
        .updateOne({ name: 'milk' }, { $set: { category: 'dairy' } }, { upsert: true });

    return {
        doomed,
        survivor,
        survivorListTitle: `${survivorName} groceries`,
        survivorRecipeTitle: `Lentil stew ${seeded}`,
        survivorTodoTitle: `${survivorName} todo`,
        doomedRecipe,
        survivorRecipe,
        doomedAiKey,
        publishedLibraryId: published.libraryId,
        survivorLibraryId: survivorPublished.libraryId,
    };
};

/** Mongo ids in Better Auth rows may be stored as strings or ObjectIds depending on the adapter. */
const idForms = (id: string): Array<string | ObjectId> => (ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]);

const count = (collection: string, filter: Document) => db.collection(collection).countDocuments(filter);

const countAuthRows = async (account: Account) => ({
    users: await count('user', { $or: [{ id: account.id }, { _id: { $in: idForms(account.id) } }] }),
    accounts: await count('account', { userId: { $in: idForms(account.id) } }),
    sessions: await count('session', { userId: { $in: idForms(account.id) } }),
});

const domainRowsOf = async (id: string) => ({
    lists: await count('list', { $or: [{ ownerId: id }, hasUser(id)] }),
    recipes: await count('recipe', { $or: [{ ownerId: id }, hasUser(id)] }),
    todos: await count('todo', { $or: [{ ownerId: id }, hasUser(id)] }),
    mealPlans: await count('mealPlan', { $or: [{ ownerId: id }, hasUser(id)] }),
    labels: await count('label', { ownerId: id }),
    pushSubscriptions: await count('pushSubscription', { userId: id }),
    friendships: await count('friendships', { $or: [{ userIds: id }, { 'users.id': id }] }),
    pairingCodes: await count('pairingCodes', { creatorId: id }),
    publications: await count('discoveryPublications', { ownerId: id }),
    reports: await count('discoveryReports', { reporterId: id }),
});

const noRows = {
    lists: 0,
    recipes: 0,
    todos: 0,
    mealPlans: 0,
    labels: 0,
    pushSubscriptions: 0,
    friendships: 0,
    pairingCodes: 0,
    publications: 0,
    reports: 0,
};

describe.skipIf(!mongoUp)('DELETE /api/account (real app, real Mongo)', () => {
    beforeAll(async () => {
        const port = freePort();
        apiBase = `http://127.0.0.1:${port}`;
        origin = `http://localhost:${port}`;
        mongo = new MongoClient(MONGO_URI);
        await mongo.connect();
        db = mongo.db(DB_NAME);

        s3 = Bun.serve({ port: 0, fetch: s3Handler });
        searchStub = Bun.serve({ port: 0, fetch: () => Response.json({ acknowledged: true, result: 'noop' }) });

        Object.assign(process.env, {
            PORT: String(port),
            CONNECTION_URI: MONGO_URI,
            DATABASE_NAME: DB_NAME,
            BETTER_AUTH_URL: origin,
            BETTER_AUTH_SECRET: 'account-delete-test-secret-account-delete-test',
            BUCKET_NAME: BUCKET,
            BUCKET_ACCESS_KEY: 'test',
            BUCKET_SECRET_KEY: 'test-secret',
            BUCKET_ENDPOINT: `127.0.0.1:${s3.port}`,
            OPENSEARCH_URL: `http://127.0.0.1:${searchStub.port}`,
            // AI off, whatever the preload or a developer's .env holds: a real key would send background calls
            // (tagging, images) to fal.ai and Gemini while the test creates and publishes recipes.
            FAL_KEY: '',
            GEMINI_API_KEY: '',
            RECIPE_IMPORT_LLM_API_KEY: '',
        });
        // Boots the whole API in this process (it listens on PORT as soon as it has connected to Mongo and S3).
        // Dynamic on purpose: importing the entry point starts the server, which needs the env set just above.
        await import('../index');

        const deadline = Date.now() + 30_000;

        while (Date.now() < deadline) {
            const up = await fetch(`${apiBase}/api/health`).then(
                (r) => r.ok,
                () => false
            );

            if (up) return;
            // Polling a real server's start-up: there is no event to await.
            await Bun.sleep(100);
        }

        throw new Error('the API did not start');
    }, 60_000);

    afterAll(async () => {
        await db?.dropDatabase().catch((): void => undefined);
        await mongo?.close().catch((): void => undefined);
        void s3?.stop(true);
        void searchStub?.stop(true);
    });

    it('removes everything the user owns and every trace of them, and leaves other people their data', async () => {
        const world = await seedWorld('Doomed', 'Survivor');
        const { doomed, survivor } = world;

        // Seeding really wrote to every collection (a vacuous pass would prove nothing).
        const before = await domainRowsOf(doomed.id);

        for (const [collection, rows] of Object.entries(before)) {
            expect(rows, `seeded ${collection}`).toBeGreaterThan(0);
        }

        expect(await countAuthRows(doomed)).toEqual({ users: 1, accounts: 1, sessions: 1 });
        expect(objects.has(world.doomedRecipe.coverImageKey)).toBe(true);
        expect(objects.has(world.doomedAiKey)).toBe(true);

        const libraryDoc = await db.collection('discoveryRecipes').findOne({ id: world.publishedLibraryId });
        const publishedCover = libraryDoc?.coverImageKey as string | undefined;
        expect(publishedCover, 'the publish copied the cover into the public prefix').toStartWith('discovery-image/');
        expect(objects.has(publishedCover as string)).toBe(true);

        const response = await call(doomed, 'DELETE', '/api/account', { username: doomed.username });
        expect(response.ok, `delete answered ${response.status}`).toBe(true);

        // Everything owned is gone, and the user is in nobody else's `users` array any more.
        expect(await domainRowsOf(doomed.id)).toEqual(noRows);
        expect(await countAuthRows(doomed)).toEqual({ users: 0, accounts: 0, sessions: 0 });

        // The user's images are gone from the object store.
        expect(objects.has(world.doomedRecipe.coverImageKey)).toBe(false);
        expect(objects.has(world.doomedAiKey)).toBe(false);
        expect([...objects.keys()].filter((key) => key.includes(`/${doomed.id}/`))).toEqual([]);

        // A public copy either goes with its publication or, if the recipe stays up, carries nothing of the user.
        const libraryAfter = await db.collection('discoveryRecipes').findOne({ id: world.publishedLibraryId });

        if (libraryAfter) {
            expect(JSON.stringify(libraryAfter)).not.toContain(doomed.id);
            expect(libraryAfter.publishedBy).toBeUndefined();
            expect(libraryAfter.attribution).not.toContain(doomed.username);
        } else {
            expect(objects.has(publishedCover as string)).toBe(false);
        }

        // The survivor's shared list, recipe, todo and meal plan still exist, without the deleted user.
        const survivorList = await db.collection('list').findOne({ title: world.survivorListTitle });
        expect(survivorList?.ownerId).toBe(survivor.id);
        expect((survivorList?.users as Array<{ id: string }>).map((member) => member.id)).toEqual([survivor.id]);
        expect((survivorList?.items as Array<{ name: string }>).map((item) => item.name)).toContain('bread');

        for (const [collection, title] of [
            ['recipe', world.survivorRecipeTitle],
            ['todo', world.survivorTodoTitle],
        ] as const) {
            const doc = await db.collection(collection).findOne({ title });
            expect(doc, `${collection} ${title} still exists`).not.toBeNull();
            expect(doc?.ownerId).toBe(survivor.id);
            expect(JSON.stringify(doc?.users ?? [])).not.toContain(doomed.id);
        }

        expect(await count('mealPlan', { ownerId: survivor.id })).toBe(1);
        expect(await count('label', { ownerId: survivor.id })).toBe(1);
        expect(await count('pushSubscription', { userId: survivor.id })).toBe(1);
        expect(await count('pairingCodes', { creatorId: survivor.id })).toBe(1);
        expect(await count('discoveryPublications', { ownerId: survivor.id })).toBe(1);
        expect(await count('discoveryRecipes', { id: world.survivorLibraryId })).toBe(1);
        expect(objects.has(world.survivorRecipe.coverImageKey)).toBe(true);

        // The survivor is still signed in and still sees the list through the API.
        const lists = (await must(
            await call(survivor, 'GET', `/api/lists/user/${survivor.id}`),
            'survivor lists'
        )) as Array<{
            title: string;
            users: Array<{ id: string }>;
        }>;

        expect(lists.map((list) => list.title)).toContain(world.survivorListTitle);
        expect(lists.flatMap((list) => list.users.map((member) => member.id))).not.toContain(doomed.id);

        // The old session cookie no longer works, and the username cannot sign in.
        expect((await call(doomed, 'GET', '/api/recipes')).status).toBe(401);
        expect((await call(doomed, 'GET', `/api/lists/user/${doomed.id}`)).status).toBe(401);

        const signIn = await call(null, 'POST', '/api/auth/sign-in/username', {
            username: doomed.username,
            password: PASSWORD,
        });

        expect(signIn.ok).toBe(false);
        expect(signIn.headers.getSetCookie().some((line) => line.startsWith('better-auth.session_token='))).toBe(false);
    }, 60_000);

    it('erases linked credentials, verification rows and every device session without signing out another user', async () => {
        const doomed = await register('AllDevices');
        const survivor = await register('StillSignedIn');

        const login = await call(null, 'POST', '/api/auth/sign-in/username', {
            username: doomed.username,
            password: PASSWORD,
        });

        await must(login, 'sign in on a second device');

        const secondCookie = login.headers
            .getSetCookie()
            .map((line) => line.split(';')[0])
            .find((pair) => pair.startsWith('better-auth.session_token='));

        expect(secondCookie).toBeDefined();
        expect(secondCookie).not.toBe(doomed.cookie);
        const secondDevice = { cookie: secondCookie as string };

        // A linked Google account and an outstanding user-bound verification must go with the password account.
        // Use the adapter's actual userId representation (Mongo may store it as an ObjectId).
        const credential = await db.collection('account').findOne({ userId: { $in: idForms(doomed.id) } });
        expect(credential).not.toBeNull();
        await db.collection('account').insertOne({
            userId: credential!.userId,
            providerId: 'google',
            accountId: `google-${doomed.id}`,
            accessToken: 'linked-google-access-token',
            refreshToken: 'linked-google-refresh-token',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        for (const who of [doomed, survivor]) {
            await db.collection('verification').insertOne({
                identifier: `user-verification-${who.id}`,
                value: who.id,
                expiresAt: new Date(Date.now() + 60_000),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        expect(await countAuthRows(doomed)).toEqual({ users: 1, accounts: 2, sessions: 2 });
        expect(await count('verification', { value: doomed.id })).toBe(1);
        expect(await count('verification', { value: survivor.id })).toBe(1);

        for (const device of [doomed, secondDevice, survivor]) {
            expect((await call(device, 'GET', '/api/recipes')).status).toBe(200);
        }

        const response = await call(doomed, 'DELETE', '/api/account', { username: doomed.username });
        expect(response.ok, `delete answered ${response.status}`).toBe(true);

        expect(await countAuthRows(doomed)).toEqual({ users: 0, accounts: 0, sessions: 0 });
        expect(await count('verification', { value: doomed.id })).toBe(0);

        for (const device of [doomed, secondDevice]) {
            expect((await call(device, 'GET', '/api/recipes')).status).toBe(401);
        }

        expect(await countAuthRows(survivor)).toEqual({ users: 1, accounts: 1, sessions: 1 });
        expect(await count('verification', { value: survivor.id })).toBe(1);
        expect((await call(survivor, 'GET', '/api/recipes')).status).toBe(200);
    }, 60_000);

    it.each([
        ['different letter case', 'CaseConfirmation', 'caseconfirmation'],
        ['trailing whitespace', 'SpaceConfirmation', 'SpaceConfirmation '],
    ])(
        'rejects a typed username with %s on the server without deleting the account',
        async (_label, name, username) => {
            const account = await register(name);
            const title = `Confirmation list ${name}`;
            await addList(account, title, [], []);
            const before = await db.collection('list').findOne({ ownerId: account.id, title });
            expect(before).not.toBeNull();

            const response = await call(account, 'DELETE', '/api/account', { username });

            expect([400, 403, 409, 422]).toContain(response.status);
            expect(await db.collection('list').findOne({ ownerId: account.id, title })).toEqual(before);
            expect(await countAuthRows(account)).toEqual({ users: 1, accounts: 1, sessions: 1 });
            expect((await call(account, 'GET', '/api/recipes')).status).toBe(200);
        }
    );

    it('is a no-op when the same account is deleted again, even at the same time', async () => {
        const { doomed, survivor } = await seedWorld('Twice', 'Bystander');

        const statuses = (
            await Promise.all([
                call(doomed, 'DELETE', '/api/account', { username: doomed.username }),
                call(doomed, 'DELETE', '/api/account', { username: doomed.username }),
            ])
        ).map((response) => response.status);

        // At least one request did the work; the other either did nothing or found the session already gone.
        expect(statuses.some((status) => status >= 200 && status < 300)).toBe(true);
        expect(statuses.filter((status) => status >= 500)).toEqual([]);
        expect(await domainRowsOf(doomed.id)).toEqual(noRows);
        expect(await countAuthRows(doomed)).toEqual({ users: 0, accounts: 0, sessions: 0 });

        // A later retry with the old cookie is refused cleanly and changes nothing.
        const bystanderBefore = await domainRowsOf(survivor.id);
        const again = await call(doomed, 'DELETE', '/api/account', { username: doomed.username });
        expect(again.status).toBe(401);
        expect(await domainRowsOf(survivor.id)).toEqual(bystanderBefore);
        expect(await countAuthRows(survivor)).toEqual({ users: 1, accounts: 1, sessions: 1 });
    }, 60_000);

    it('needs a signed-in caller', async () => {
        const response = await call(null, 'DELETE', '/api/account', { username: 'whoever' });

        expect(response.status).toBe(401);
    });

    it.each([
        ['a different username than the typed confirmation', { username: 'somebody-else' }],
        ['an empty confirmation', { username: '' }],
        ['a body without the typed username', {}],
    ])(
        'refuses and deletes nothing when the request carries %s',
        async (_label, body) => {
            const world = await seedWorld(
                `Careful${Math.floor(Math.random() * 1e6)}`,
                `Other${Math.floor(Math.random() * 1e6)}`
            );

            const before = await domainRowsOf(world.doomed.id);

            const response = await call(world.doomed, 'DELETE', '/api/account', body);

            // A refusal of this request (bad input or not allowed), not a missing route or a server failure.
            expect([400, 403, 409, 422]).toContain(response.status);
            expect(await domainRowsOf(world.doomed.id)).toEqual(before);
            expect(await countAuthRows(world.doomed)).toEqual({ users: 1, accounts: 1, sessions: 1 });
            expect(objects.has(world.doomedRecipe.coverImageKey)).toBe(true);
            // Still signed in.
            expect((await call(world.doomed, 'GET', '/api/recipes')).status).toBe(200);
        },
        60_000
    );
});
