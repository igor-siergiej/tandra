import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mongodbAdapter } from '@better-auth/mongo-adapter';
import type { MongoDbConnection } from '@imapps/api-utils';
import { errorHandler } from '@imapps/api-utils/hono';
import type { User } from '@tandra/types';
import {
    createListBody,
    createMealPlanBody,
    createRecipeBody,
    createTodoBody,
    deleteAccountBody,
    friendIdBody,
    updateListBody,
    updateMealPlanBody,
    updateRecipeBody,
    updateTodoBody,
} from '@tandra/types/schemas';
import { parse } from 'dotenv';
import { Hono } from 'hono';
import { MongoClient } from 'mongodb';

import { dependencyContainer } from '../dependencies/container';
import { type Collections, DependencyToken } from '../dependencies/types';
import { AccountService, type ObjectEraser } from '../domain/AccountService';
import { AuthorizationService } from '../domain/AuthorizationService';
import { FriendService } from '../domain/FriendService';
import { ListService } from '../domain/ListService';
import { MealPlanService } from '../domain/MealPlanService';
import { RecipeService } from '../domain/RecipeService';
import { TodoService } from '../domain/TodoService';
import { type Auth, createAuth, createCredentialsEraser } from '../infrastructure/BetterAuth';
import { MongoDiscoveryPublicationRepository } from '../infrastructure/MongoDiscoveryPublicationRepository';
import { MongoDiscoveryReportRepository } from '../infrastructure/MongoDiscoveryReportRepository';
import { MongoFriendRepository } from '../infrastructure/MongoFriendRepository';
import { MongoLabelRepository } from '../infrastructure/MongoLabelRepository';
import { MongoListInviteRepository } from '../infrastructure/MongoListInviteRepository';
import { MongoListRepository } from '../infrastructure/MongoListRepository';
import { MongoMealPlanRepository } from '../infrastructure/MongoMealPlanRepository';
import { MongoPushSubscriptionRepository } from '../infrastructure/MongoPushSubscriptionRepository';
import { MongoRecipeRepository } from '../infrastructure/MongoRecipeRepository';
import { MongoTodoRepository } from '../infrastructure/MongoTodoRepository';
import { deleteAccount } from '../interfaces/AccountHandlers';
import { type HonoVars } from '../interfaces/handlerUtils';
import { addList, addUserToList, updateList } from '../interfaces/ListHandlers';
import { createMealPlanEntry, updateMealPlanEntry } from '../interfaces/MealPlanHandlers';
import { addUserToRecipe, createRecipe, updateRecipe } from '../interfaces/RecipeHandlers';
import { createTodo, updateTodo } from '../interfaces/TodoHandlers';
import { authenticate } from '../middleware/auth';
import { validateJson } from '../middleware/validate';

const rootEnv = join(import.meta.dir, '../../../../.env');
const configuredUri = existsSync(rootEnv) ? parse(readFileSync(rootEnv)).CONNECTION_URI : undefined;

const mongo = new MongoClient(process.env.MONGO_TEST_URI ?? configuredUri ?? 'mongodb://localhost:27017', {
    serverSelectionTimeoutMS: 1500,
});

const db = mongo.db(`tandra_stale_sharing_${crypto.randomUUID().replaceAll('-', '')}`);
let mongoUp = false;

try {
    await mongo.connect();
    await db.command({ listCollections: 1 });
    mongoUp = true;
} catch {
    await mongo.close();
}

interface Account extends User {
    cookie: string;
}

interface World {
    owner: Account;
    deleted: Account;
    friend: Account;
    stranger: Account;
    listId: string;
    recipeId: string;
    todoId: string;
    mealId: string;
}

let app: Hono<HonoVars>;
let auth: Auth;
let friends: FriendService;
let counter = 0;

const call = (as: Account | null, method: string, path: string, body?: unknown) =>
    app.request(`http://localhost:4001${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:4001',
            'X-Forwarded-For': `10.2.${(counter >> 8) & 255}.${++counter & 255}`,
            ...(as && { Cookie: as.cookie }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

const must = async (response: Response): Promise<{ id: string; users?: User[] }> => {
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

    return response.json();
};

const signup = async (role: string): Promise<Account> => {
    const username = `${role}${++counter}`;

    const response = await call(null, 'POST', '/api/auth/sign-up/email', {
        username,
        name: username,
        email: `${username}@users.invalid`,
        password: 'correct-horse-battery',
    });

    if (!response.ok) throw new Error(`Signup ${response.status}: ${await response.text()}`);
    const { user } = (await response.json()) as { user: User };

    const cookie = response.headers
        .getSetCookie()
        .map((line) => line.split(';')[0])
        .join('; ');

    return { id: user.id, username, cookie };
};

const seed = async (): Promise<World> => {
    const owner = await signup('owner');
    const deleted = await signup('deleted');
    const friend = await signup('friend');
    const stranger = await signup('stranger');
    const ownerIdentity = { id: owner.id, username: owner.username };
    await friends.createFriendship(ownerIdentity, { id: deleted.id, username: deleted.username });
    await friends.createFriendship(ownerIdentity, { id: friend.id, username: friend.username });
    const selectedUsers = [deleted.id, friend.id];
    const listId = crypto.randomUUID();
    await must(await call(owner, 'PUT', '/api/lists', { id: listId, title: listId, selectedUsers }));

    const recipe = await must(
        await call(owner, 'PUT', '/api/recipes', {
            title: 'Soup',
            ingredients: [],
            selectedUsers,
        })
    );

    const todo = await must(await call(owner, 'PUT', '/api/todos', { title: 'Original', userIds: selectedUsers }));

    const meal = await must(
        await call(owner, 'PUT', '/api/meal-plan', {
            date: '2026-11-20',
            servings: 2,
            recipeId: recipe.id,
            userIds: selectedUsers,
        })
    );

    expect((await db.collection('todo').findOne({ id: todo.id }))?.users).toContainEqual({
        id: deleted.id,
        username: deleted.username,
    });
    const response = await call(deleted, 'DELETE', '/api/account', { username: deleted.username });
    expect(response.status).toBe(204);

    for (const collection of ['list', 'recipe', 'todo', 'mealPlan']) {
        expect(await db.collection(collection).countDocuments({ 'users.id': deleted.id })).toBe(0);
    }

    return { owner, deleted, friend, stranger, listId, recipeId: recipe.id, todoId: todo.id, mealId: meal.id };
};

type SharingCase = {
    name: string;
    method: string;
    path: (world: World) => string;
    body: (world: World, member: User) => object;
};

const sharingCases: SharingCase[] = [
    {
        name: 'todo membership replacement',
        method: 'POST',
        path: (w) => `/api/todos/${w.todoId}`,
        body: (_w, member) => ({ title: 'Stale edit', users: [member] }),
    },
    {
        name: 'list member addition',
        method: 'POST',
        path: (w) => `/api/lists/${w.listId}/users`,
        body: (_w, member) => ({ friendId: member.id, username: member.username }),
    },
    {
        name: 'recipe member addition',
        method: 'POST',
        path: (w) => `/api/recipes/${w.recipeId}/users`,
        body: (_w, member) => ({ friendId: member.id, username: member.username }),
    },
    {
        name: 'list creation',
        method: 'PUT',
        path: () => '/api/lists',
        body: (_w, member) => ({ title: crypto.randomUUID(), selectedUsers: [member.id] }),
    },
    {
        name: 'recipe creation',
        method: 'PUT',
        path: () => '/api/recipes',
        body: (_w, member) => ({ title: 'New soup', ingredients: [], selectedUsers: [member.id] }),
    },
    {
        name: 'todo creation',
        method: 'PUT',
        path: () => '/api/todos',
        body: (_w, member) => ({ title: 'New todo', userIds: [member.id] }),
    },
    {
        name: 'meal-plan creation',
        method: 'PUT',
        path: () => '/api/meal-plan',
        body: (w, member) => ({ date: '2026-11-20', servings: 2, recipeId: w.recipeId, userIds: [member.id] }),
    },
];

const contentCases = [
    {
        name: 'list rename',
        path: (w: World) => `/api/lists/${w.listId}`,
        body: { newTitle: 'Renamed' },
        collection: 'list',
        id: (w: World) => w.listId,
    },
    {
        name: 'recipe content update',
        path: (w: World) => `/api/recipes/${w.recipeId}`,
        body: { title: 'Edited soup', ingredients: [] as never[] },
        collection: 'recipe',
        id: (w: World) => w.recipeId,
    },
    {
        name: 'todo content update',
        path: (w: World) => `/api/todos/${w.todoId}`,
        body: { title: 'Edited todo' },
        collection: 'todo',
        id: (w: World) => w.todoId,
    },
    {
        name: 'meal-plan content update',
        path: (w: World) => `/api/meal-plan/${w.mealId}`,
        body: { servings: 4 },
        collection: 'mealPlan',
        id: (w: World) => w.mealId,
    },
];

// Real HTTP handlers, validation, authentication, domain services, deletion and Mongo repositories; no listening server.
describe.skipIf(!mongoUp)('sharing after account deletion (HTTP)', () => {
    beforeAll(() => {
        const connection = {
            getCollection: <K extends keyof Collections>(name: K) => db.collection<Collections[K]>(name),
        } as unknown as MongoDbConnection<Collections>;

        auth = createAuth({
            database: mongodbAdapter(db, { transaction: false }),
            secret: 'stale-sharing-secret-at-least-32-characters',
            baseURL: 'http://localhost:4001',
            trustedOrigins: ['http://localhost:4001'],
        });
        const lists = new MongoListRepository(connection);
        const recipes = new MongoRecipeRepository(connection);
        const todos = new MongoTodoRepository(connection);
        const mealPlans = new MongoMealPlanRepository(connection);
        const friendRepo = new MongoFriendRepository(connection);
        const ids = { generate: () => crypto.randomUUID() };
        const objects = new Map<string, Uint8Array>();

        const eraser: ObjectEraser = {
            listKeys: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)),
            removeKeys: async (keys) => {
                for (const key of keys) objects.delete(key);
            },
        };

        friends = new FriendService(friendRepo, ids, undefined, lists, recipes, todos, mealPlans);
        const recipeService = new RecipeService(recipes, ids, eraser, undefined, undefined, undefined, friends);

        const services = {
            [DependencyToken.Auth]: auth,
            [DependencyToken.Logger]: { info: () => {}, warn: () => {}, error: () => {} },
            [DependencyToken.AuthorizationService]: new AuthorizationService(),
            [DependencyToken.ListService]: new ListService(lists, ids, undefined, undefined, undefined, friends),
            [DependencyToken.RecipeService]: recipeService,
            [DependencyToken.TodoService]: new TodoService(todos, ids, undefined, friends),
            [DependencyToken.MealPlanService]: new MealPlanService(mealPlans, ids, recipeService, undefined, friends),
            [DependencyToken.AccountService]: new AccountService({
                lists,
                recipes,
                todos,
                mealPlans,
                labels: new MongoLabelRepository(connection),
                pushSubscriptions: new MongoPushSubscriptionRepository(connection),
                friends: friendRepo,
                invites: new MongoListInviteRepository(connection),
                publications: new MongoDiscoveryPublicationRepository(connection),
                reports: new MongoDiscoveryReportRepository(connection),
                discovery: {
                    getRecipes: async () => {
                        throw new Error('No publications are seeded');
                    },
                    remove: async () => {
                        throw new Error('No publications are seeded');
                    },
                },
                images: eraser,
                credentials: createCredentialsEraser(auth),
                disconnect: () => {},
            }),
        };

        for (const [token, service] of Object.entries(services)) {
            dependencyContainer.registerSingleton(
                token as never,
                function () {
                    return service;
                } as never
            );
        }

        app = new Hono<HonoVars>();
        app.onError(errorHandler);
        app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
        app.use('/api/*', authenticate);
        app.delete('/api/account', validateJson(deleteAccountBody), deleteAccount);
        app.put('/api/lists', validateJson(createListBody), addList);
        app.post('/api/lists/:title', validateJson(updateListBody), updateList);
        app.post('/api/lists/:title/users', validateJson(friendIdBody), addUserToList);
        app.put('/api/recipes', validateJson(createRecipeBody), createRecipe);
        app.put('/api/recipes/:recipeId', validateJson(updateRecipeBody), updateRecipe);
        app.post('/api/recipes/:recipeId/users', validateJson(friendIdBody), addUserToRecipe);
        app.put('/api/todos', validateJson(createTodoBody), createTodo);
        app.post('/api/todos/:id', validateJson(updateTodoBody), updateTodo);
        app.put('/api/meal-plan', validateJson(createMealPlanBody), createMealPlanEntry);
        app.post('/api/meal-plan/:id', validateJson(updateMealPlanBody), updateMealPlanEntry);
    });

    afterAll(async () => {
        await db.dropDatabase();
        await mongo.close();
    });

    it.each(sharingCases)(
        '$name refuses deleted and nonfriend identities after deletion',
        async (row) => {
            const world = await seed();

            for (const member of [world.deleted, world.stranger]) {
                const response = await call(world.owner, row.method, row.path(world), row.body(world, member));
                expect(response.status, await response.text()).toBe(403);

                for (const collection of ['list', 'recipe', 'todo', 'mealPlan']) {
                    expect(await db.collection(collection).countDocuments({ 'users.id': world.deleted.id })).toBe(0);
                    expect(await db.collection(collection).countDocuments({ 'users.id': world.stranger.id })).toBe(0);
                }
            }
        },
        60_000
    );

    it.each(sharingCases)(
        '$name refuses a deleted account even if an obsolete friendship row survives',
        async (row) => {
            const world = await seed();
            await db.collection('friendships').insertOne({
                id: crypto.randomUUID(),
                userIds: [world.owner.id, world.deleted.id].sort(),
                users: [world.owner, world.deleted].map(({ id, username }) => ({ id, username })),
                createdAt: new Date(),
            });
            const response = await call(world.owner, row.method, row.path(world), row.body(world, world.deleted));
            expect(response.status, await response.text()).toBe(403);

            for (const collection of ['list', 'recipe', 'todo', 'mealPlan']) {
                expect(await db.collection(collection).countDocuments({ 'users.id': world.deleted.id })).toBe(0);
            }
        },
        60_000
    );

    it.each(sharingCases)(
        '$name uses canonical friend details, never supplied or cached usernames',
        async (row) => {
            const world = await seed();

            // Force membership additions down the actual add path, rather than already-member handling.
            for (const collection of ['list', 'recipe', 'todo', 'mealPlan']) {
                await db
                    .collection<{ ownerId: string; users: User[] }>(collection)
                    .updateMany({ ownerId: world.owner.id }, { $pull: { users: { id: world.friend.id } } });
            }

            const spoofed = { id: world.friend.id, username: world.deleted.username };
            // A denormalized friendship snapshot is not a canonical account record either.
            await db.collection('friendships').updateMany(
                { userIds: world.friend.id },
                {
                    $set: { 'users.$[friend].username': world.deleted.username },
                },
                { arrayFilters: [{ 'friend.id': world.friend.id }] }
            );
            const response = await call(world.owner, row.method, row.path(world), row.body(world, spoofed));
            expect(response.ok, await response.clone().text()).toBe(true);
            const serialized = await response.text();
            expect(serialized).not.toContain(world.deleted.username);

            for (const collection of ['list', 'recipe', 'todo', 'mealPlan']) {
                const shared = await db
                    .collection(collection)
                    .find({ ownerId: world.owner.id, 'users.id': world.friend.id })
                    .toArray();

                for (const document of shared) {
                    expect(document.users).toContainEqual({ id: world.friend.id, username: world.friend.username });
                    expect(JSON.stringify(document)).not.toContain(world.deleted.username);
                }
            }

            const count = await Promise.all(
                ['list', 'recipe', 'todo', 'mealPlan'].map((collection) =>
                    db.collection(collection).countDocuments({ ownerId: world.owner.id, 'users.id': world.friend.id })
                )
            );

            expect(count.reduce((sum, value) => sum + value, 0)).toBe(1);
        },
        60_000
    );

    it.each(contentCases)(
        '$name does not restore membership from a stale client snapshot',
        async (row) => {
            const world = await seed();

            const body = {
                ...row.body,
                ...(row.collection !== 'todo' && { users: [world.deleted], userIds: [world.deleted.id] }),
            };

            const response = await call(
                world.owner,
                row.collection === 'recipe' ? 'PUT' : 'POST',
                row.path(world),
                body
            );

            expect(response.ok, await response.clone().text()).toBe(true);
            const document = await db.collection(row.collection).findOne({ id: row.id(world) });
            expect(JSON.stringify(document)).not.toContain(world.deleted.id);
            expect(JSON.stringify(document)).not.toContain(world.deleted.username);
            expect(document?.users).toContainEqual({ id: world.friend.id, username: world.friend.username });
        },
        60_000
    );

    it.each(sharingCases.filter((row) => row.method === 'PUT'))(
        '$name defaults only to surviving friends',
        async (row) => {
            const world = await seed();
            const body: Record<string, unknown> = { ...row.body(world, world.deleted) };
            delete body.selectedUsers;
            delete body.userIds;
            const created = await must(await call(world.owner, row.method, row.path(world), body));
            expect(created.users).toContainEqual({ id: world.friend.id, username: world.friend.username });
            expect(JSON.stringify(created)).not.toContain(world.deleted.id);
            expect(JSON.stringify(created)).not.toContain(world.deleted.username);
        },
        60_000
    );

    it('lets members edit todo content without replacing owner-controlled sharing', async () => {
        const world = await seed();

        const response = await call(world.friend, 'POST', `/api/todos/${world.todoId}`, {
            title: 'Member edit',
            users: [world.deleted, world.stranger],
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            title: 'Member edit',
            users: [
                {
                    id: world.friend.id,
                    username: world.friend.username,
                },
            ],
        });
        const denied = await call(world.stranger, 'POST', `/api/todos/${world.todoId}`, { title: 'Intruder edit' });
        expect(denied.status).toBe(403);
    }, 60_000);
});
