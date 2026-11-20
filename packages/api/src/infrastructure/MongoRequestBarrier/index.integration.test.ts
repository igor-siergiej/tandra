import { afterAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { mongodbAdapter } from '@better-auth/mongo-adapter';
import type { MongoDbConnection } from '@imapps/api-utils';
import { ListType, type Recipe, type Todo, type User } from '@tandra/types';
import { parse } from 'dotenv';
import { Hono } from 'hono';
import { type Db, MongoClient } from 'mongodb';

import type { Collections } from '../../dependencies/types';
import { AccountService, type ObjectEraser } from '../../domain/AccountService';
import { DiscoveryPublishService } from '../../domain/DiscoveryPublish';
import { DiscoveryService } from '../../domain/DiscoveryService';
import type { DiscoveryIndex } from '../../domain/DiscoveryService/types';
import type { ImageStore } from '../../domain/ImageService/types';
import { RecipeImageService } from '../../domain/RecipeImageService';
import { RecipeService } from '../../domain/RecipeService';
import { requestBarrier } from '../../middleware/requestBarrier';
import { type Auth, createAuth, createCredentialsEraser } from '../BetterAuth';
import { MongoDiscoveryPublicationRepository } from '../MongoDiscoveryPublicationRepository';
import { MongoDiscoveryRecipeRepository } from '../MongoDiscoveryRecipeRepository';
import { MongoDiscoveryReportRepository } from '../MongoDiscoveryReportRepository';
import { MongoFriendRepository } from '../MongoFriendRepository';
import { MongoLabelRepository } from '../MongoLabelRepository';
import { MongoListInviteRepository } from '../MongoListInviteRepository';
import { MongoListRepository } from '../MongoListRepository';
import { MongoMealPlanRepository } from '../MongoMealPlanRepository';
import { MongoPushSubscriptionRepository } from '../MongoPushSubscriptionRepository';
import { MongoRecipeRepository } from '../MongoRecipeRepository';
import { MongoTodoRepository } from '../MongoTodoRepository';
import { MongoRequestBarrier, type RequestBarrierState } from './index';

const rootEnv = join(import.meta.dir, '../../../../../.env');
const configuredUri = existsSync(rootEnv) ? parse(readFileSync(rootEnv)).CONNECTION_URI : undefined;

const mongo = new MongoClient(process.env.MONGO_TEST_URI ?? configuredUri ?? 'mongodb://localhost:27017', {
    serverSelectionTimeoutMS: 1500,
});

const dbName = `tandra_barrier_${crypto.randomUUID().replaceAll('-', '')}`;
const db = mongo.db(dbName);
let mongoUp = false;

try {
    await mongo.connect();
    await db.command({ listCollections: 1 });
    mongoUp = true;
} catch {
    await mongo.close();
}

const deferred = () => {
    let resolve!: () => void;

    const promise = new Promise<void>((done) => {
        resolve = done;
    });

    return { promise, resolve };
};

const password = 'correct-horse-battery';

interface World {
    database: Db;
    auth: Auth;
    cookie: string;
    user: User;
    other: User;
    objects: Map<string, Buffer>;
    indexed: Set<string>;
    lists: MongoListRepository;
    recipes: MongoRecipeRepository;
    todos: MongoTodoRepository;
    library: MongoDiscoveryRecipeRepository;
    publications: MongoDiscoveryPublicationRepository;
    recipe: Recipe;
    recipeService: RecipeService;
    publish: DiscoveryPublishService;
    account: AccountService;
    staleTodo: Todo;
}

const setup = async (database: Db): Promise<World> => {
    // SAFETY: repositories only use getCollection; this returns real Mongo collections, not a database mock.
    const connection = {
        getCollection: <K extends keyof Collections>(name: K) => database.collection<Collections[K]>(name),
    } as unknown as MongoDbConnection<Collections>;

    const auth = createAuth({
        database: mongodbAdapter(database, { transaction: false }),
        secret: 'request-barrier-test-secret-at-least-32-characters',
        baseURL: 'http://localhost:4001',
        trustedOrigins: ['http://localhost:4001'],
    });

    const signup = await auth.api.signUpEmail({
        body: { username: 'eraseme', name: 'eraseme', email: 'unused@users.invalid', password },
        asResponse: true,
    });

    expect(signup.status).toBe(200);

    const cookie = signup.headers
        .getSetCookie()
        .map((line) => line.split(';')[0])
        .join('; ');

    const session = await auth.api.getSession({ headers: new Headers({ Cookie: cookie }) });

    if (!session) throw new Error('Test signup created no session');
    const user: User = { id: session.user.id, username: 'eraseme' };
    const other: User = { id: 'other-owner', username: 'other-owner-name' };
    const objects = new Map<string, Buffer>();

    const eraser: ObjectEraser = {
        listKeys: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)),
        removeKeys: async (keys) => {
            for (const key of keys) objects.delete(key);
        },
    };

    const store: ImageStore = {
        getHeadObject: async (key) => {
            if (!objects.has(key)) throw new Error('NoSuchKey');

            return { metaData: { 'content-type': 'image/webp' } };
        },
        getObjectStream: async (key) => {
            const bytes = objects.get(key);

            if (!bytes) throw new Error('NoSuchKey');

            return Readable.from(bytes);
        },
        putObject: async (key, bytes) => {
            objects.set(key, bytes);
        },
    };

    const indexed = new Set<string>();

    const index: DiscoveryIndex = {
        ensureIndex: async () => {},
        index: async (recipe) => {
            indexed.add(recipe.id);
        },
        remove: async (id) => {
            indexed.delete(id);
        },
        search: async () => {
            throw new Error('Unused search');
        },
        similar: async () => {
            throw new Error('Unused similar');
        },
        rebuild: async () => {
            throw new Error('Unused rebuild');
        },
    };

    const lists = new MongoListRepository(connection);
    const recipes = new MongoRecipeRepository(connection);
    const todos = new MongoTodoRepository(connection);
    const publications = new MongoDiscoveryPublicationRepository(connection);
    const library = new MongoDiscoveryRecipeRepository(connection);
    const discovery = new DiscoveryService(library, index);
    const ids = { generate: () => crypto.randomUUID() };

    const imageService = new RecipeImageService(store, {
        generateImage: async () => ({ buffer: Buffer.from('generated photo'), contentType: 'image/webp' }),
    });

    const recipeService = new RecipeService(recipes, ids, eraser, undefined, undefined, imageService);
    const publish = new DiscoveryPublishService(discovery, publications, recipeService, store, ids, eraser);

    const recipe: Recipe = {
        id: 'r',
        ownerId: user.id,
        users: [user],
        dateAdded: new Date(0),
        title: 'Soup',
        ingredients: [{ id: 'carrot', name: 'Carrot' }],
        instructions: ['Simmer'],
        coverImageKey: `recipe-upload/${user.id}/r/cover.webp`,
    };

    await recipes.insert(recipe);
    objects.set(recipe.coverImageKey!, Buffer.from('private cover'));
    await todos.insert({
        id: 'shared',
        title: 'Original',
        ownerId: other.id,
        users: [user, other],
        done: false,
        dateAdded: new Date(0),
    });
    const staleTodo = await todos.getById('shared');

    if (!staleTodo) throw new Error('Missing shared todo');

    const account = new AccountService({
        lists,
        recipes,
        todos,
        mealPlans: new MongoMealPlanRepository(connection),
        labels: new MongoLabelRepository(connection),
        pushSubscriptions: new MongoPushSubscriptionRepository(connection),
        friends: new MongoFriendRepository(connection),
        invites: new MongoListInviteRepository(connection),
        publications,
        reports: new MongoDiscoveryReportRepository(connection),
        discovery,
        images: eraser,
        credentials: createCredentialsEraser(auth),
        disconnect: () => {},
    });

    return {
        database,
        auth,
        cookie,
        user,
        other,
        objects,
        indexed,
        lists,
        recipes,
        todos,
        library,
        publications,
        recipe,
        recipeService,
        publish,
        account,
        staleTodo,
    };
};

const scenarios = [
    {
        name: 'owned list insertion',
        method: 'PUT',
        path: '/api/lists',
        write: async (w: World) => {
            await w.lists.insert({
                id: 'late-list',
                title: 'Late list',
                ownerId: w.user.id,
                users: [w.user],
                dateAdded: new Date(0),
                listType: ListType.SHOPPING,
                items: [],
            });
        },
        beforeErase: async (w: World) => expect((await w.lists.getByRef('late-list'))?.ownerId).toBe(w.user.id),
    },
    {
        name: 'publication and public cover creation',
        method: 'POST',
        path: '/api/recipes/r/publish',
        write: async (w: World) => {
            await w.publish.publish('r', w.user, { agreeToLicence: true });
        },
        beforeErase: async (w: World) => {
            const publication = await w.publications.getByRecipeId('r');
            expect(publication?.publishedAt).toBeInstanceOf(Date);
            const published = await w.library.getById(publication!.libraryId);
            expect(w.objects.get(published!.coverImageKey!)?.toString()).toBe('private cover');
        },
    },
    {
        name: 'AI recipe image generation',
        method: 'POST',
        path: '/api/recipes/r/image/generate',
        write: async (w: World) => {
            await w.recipeService.regenerateImage('r', w.user.id);
        },
        beforeErase: async (w: World) =>
            expect(w.objects.get('recipe-image/r.webp')?.toString()).toBe('generated photo'),
    },
    {
        name: 'other owner editing a stale member snapshot',
        method: 'PUT',
        path: '/api/todos/shared',
        write: async (w: World) => {
            await w.todos.update('shared', { ...w.staleTodo, title: 'Owner edit' });
        },
        beforeErase: async (w: World) => expect((await w.todos.getById('shared'))?.title).toBe('Owner edit'),
    },
    {
        name: 'Better Auth issuing a new device session',
        method: 'POST',
        path: '/api/auth/sign-in/username',
        write: async (w: World) => {
            await w.auth.api.signInUsername({ body: { username: w.user.username, password } });
        },
        beforeErase: async (w: World) => expect(await w.database.collection('session').countDocuments({})).toBe(2),
    },
];

// Independent instances model API replicas. Hono dispatches requests without starting a dev server.
describe.skipIf(!mongoUp)('deletion versus active API operations (Mongo barrier)', () => {
    const databases: Db[] = [];
    afterAll(async () => {
        await Promise.all(databases.map((database) => database.dropDatabase()));
        await db.dropDatabase();
        await mongo.close();
    });

    it.each(scenarios)('drains $name before erasing and reauthenticates queued requests', async (scenario) => {
        const database = mongo.db(`${dbName}_${databases.length}`);
        databases.push(database);
        const world = await setup(database);
        const collection = database.collection<RequestBarrierState>('requestBarrier');
        const started = deferred();
        const finishWrite = deferred();
        const erasing = deferred();
        const finishErase = deferred();
        let activeHandlers = 0;

        const makeApp = () => {
            const app = new Hono();
            app.use('/api/*', requestBarrier(new MongoRequestBarrier(collection)));
            app.use('/api/*', async (c, next) => {
                const session = await world.auth.api.getSession({ headers: c.req.raw.headers });

                if (!session) return c.json({ error: 'Unauthorized' }, 401);
                await next();
            });
            app.on(scenario.method, scenario.path, async (c) => {
                activeHandlers += 1;
                started.resolve();
                await finishWrite.promise;
                await scenario.write(world);

                return c.json({ written: true });
            });
            app.get('/api/me', (c) => c.json({ id: world.user.id }));
            app.delete('/api/account', async (c) => {
                erasing.resolve();
                await finishErase.promise;
                await world.account.deleteAccount(world.user, world.user.username);

                return c.body(null, 204);
            });

            return app;
        };

        const appA = makeApp();
        const appB = makeApp();
        const headers = { Cookie: world.cookie };
        const write = appA.request(scenario.path, { method: scenario.method, headers });
        await started.promise;
        const deletion = appB.request('/api/account', { method: 'DELETE', headers });
        await waitUntil(async () => (await collection.findOne({ writer: { $ne: null } })) !== null);
        let deleted = false;
        void erasing.promise.then(() => {
            deleted = true;
        });
        const queued = appA.request('/api/me', { headers });
        expect(deleted).toBe(false);
        finishWrite.resolve();
        expect((await write).status).toBe(200);
        await erasing.promise;
        await scenario.beforeErase(world);
        finishErase.resolve();
        expect((await deletion).status).toBe(204);
        expect((await queued).status).toBe(401);
        expect(activeHandlers).toBe(1);

        for (const name of [
            'list',
            'recipe',
            'discoveryRecipe',
            'discoveryPublication',
            'user',
            'account',
            'session',
        ]) {
            expect(await database.collection(name).countDocuments({})).toBe(0);
        }

        expect(world.objects.size).toBe(0);
        expect(world.indexed.size).toBe(0);
        const remaining = await world.todos.getById('shared');
        expect(remaining?.ownerId).toBe(world.other.id);
        expect(remaining?.users).toEqual([world.other]);

        if (scenario.method === 'PUT' && scenario.path === '/api/todos/shared')
            expect(remaining?.title).toBe('Owner edit');
    });

    it('serializes ownership-discard operations and releases the fence after errors', async () => {
        const collection = db.collection<RequestBarrierState>('failureBarrier');
        const first = new MongoRequestBarrier(collection);
        const second = new MongoRequestBarrier(collection);
        const release = await first.acquire(true);
        let entered = false;

        const next = second.acquire(true).then((unlock) => {
            entered = true;

            return unlock;
        });

        expect((await collection.findOne({}))?.writer).not.toBeNull();
        expect(entered).toBe(false);
        await release();
        await (
            await next
        )();
        const app = new Hono();
        app.onError((_error, c) => c.json({ error: 'object store unavailable' }, 500));
        app.use('*', requestBarrier(first));
        app.delete('/api/account', () => {
            throw new Error('object store unavailable');
        });
        app.get('/api/recipes', (c) => c.json({ recipes: [] }));
        expect((await app.request('/api/account', { method: 'DELETE' })).status).toBe(500);
        expect((await app.request('/api/recipes')).status).toBe(200);
        expect(await collection.findOne({})).toMatchObject({ readers: [], writer: null });
    });
});

async function waitUntil(predicate: () => Promise<boolean>) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await predicate()) return;
        // Real-Mongo polling: a fake clock cannot advance another client's database I/O.
        await Bun.sleep(10);
    }

    throw new Error('Admission fence was not persisted');
}
