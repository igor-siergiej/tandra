import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { MongoDbConnection } from '@imapps/api-utils';
import type { List, MealPlanEntry, Recipe, Todo, User } from '@tandra/types';
import { ListType } from '@tandra/types';
import { parse } from 'dotenv';
import { type Db, MongoClient } from 'mongodb';

import type { Collections } from '../dependencies/types';
import { TodoService } from '../domain/TodoService';
import { MongoListRepository } from './MongoListRepository';
import { MongoMealPlanRepository } from './MongoMealPlanRepository';
import { MongoRecipeRepository } from './MongoRecipeRepository';
import { MongoTodoRepository } from './MongoTodoRepository';

const rootEnv = join(import.meta.dir, '../../../../.env');
const configuredUri = existsSync(rootEnv) ? parse(readFileSync(rootEnv)).CONNECTION_URI : undefined;
const mongoUri = process.env.MONGO_TEST_URI ?? configuredUri ?? 'mongodb://localhost:27017';
const dbName = `tandra_membership_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 1500 });
let mongoUp = false;

try {
    await mongo.connect();
    await mongo.db(dbName).command({ listCollections: 1 });
    mongoUp = true;
} catch {
    await mongo.close();
}

const owner: User = { id: 'owner', username: 'owner-name' };
const deleted: User = { id: 'deleted', username: 'deleted-name' };
const remaining: User = { id: 'remaining', username: 'remaining-name' };
const dateAdded = new Date('2026-11-20');

type SharedDocument = { id: string; users?: User[] };

type SharedRepository<T> = {
    insert(document: T): Promise<unknown>;
    update(id: string, document: T): Promise<T>;
    getById(id: string): Promise<T | null>;
    removeMemberEverywhere(id: string): Promise<void>;
};

const row = <T extends SharedDocument>(
    name: string,
    create: (connection: MongoDbConnection<Collections>) => SharedRepository<T>,
    document: T,
    change: Partial<T>
) => ({
    name,
    async run(connection: MongoDbConnection<Collections>) {
        const repository = create(connection);
        await repository.insert(document);
        const stale = await repository.getById(document.id);
        expect(stale).not.toBeNull();

        await repository.removeMemberEverywhere(deleted.id);
        await expect(repository.update(document.id, { ...stale!, ...change })).rejects.toMatchObject({ status: 409 });

        const afterConflict = await repository.getById(document.id);
        expect(afterConflict?.users).toEqual(document.users?.filter((user) => user.id !== deleted.id));
        expect(JSON.stringify(afterConflict)).not.toContain(deleted.id);
        expect(JSON.stringify(afterConflict)).not.toContain(deleted.username);

        for (const field of Object.keys(change) as Array<keyof T>) {
            expect(afterConflict?.[field]).toEqual(document[field]);
        }

        const updated = await repository.update(document.id, { ...afterConflict!, ...change });
        expect(updated).toMatchObject(change);
        expect(updated.users).toEqual(afterConflict?.users);
        expect((await repository.getById(document.id))?.users).toEqual(afterConflict?.users);
    },
});

const rows = [
    row<Recipe>(
        'recipe',
        (connection) => new MongoRecipeRepository(connection),
        {
            id: 'recipe',
            ownerId: owner.id,
            title: 'Original recipe',
            ingredients: [],
            users: [owner, deleted, remaining],
            dateAdded,
        },
        { title: 'Owner edit' }
    ),
    row<Todo>(
        'todo',
        (connection) => new MongoTodoRepository(connection),
        {
            id: 'todo',
            ownerId: owner.id,
            title: 'Original todo',
            done: false,
            users: [deleted, remaining],
            dateAdded,
        },
        { title: 'Owner edit' }
    ),
    row<MealPlanEntry>(
        'mealPlan',
        (connection) => new MongoMealPlanRepository(connection),
        {
            id: 'mealPlan',
            ownerId: owner.id,
            recipeId: 'recipe',
            date: '2026-11-20',
            servings: 2,
            users: [deleted, remaining],
            dateAdded,
        },
        { servings: 4 }
    ),
    row<List>(
        'list',
        (connection) => {
            const repository = new MongoListRepository(connection);

            return {
                insert: (document) => repository.insert(document),
                getById: (id) => repository.getByRef(id),
                removeMemberEverywhere: (id) => repository.removeMemberEverywhere(id),
                async update(id, document) {
                    const revision = await repository.replaceIfUnchanged(id, document);

                    if (revision === null) throw Object.assign(new Error('List changed'), { status: 409 });

                    return { ...document, revision };
                },
            };
        },
        {
            id: 'list',
            ownerId: owner.id,
            title: 'Original list',
            items: [],
            listType: ListType.SHOPPING,
            users: [owner, deleted, remaining],
            dateAdded,
        },
        { title: 'Owner edit' }
    ),
];

describe.skipIf(!mongoUp)('Mongo membership deletion versus stale replacement', () => {
    let db: Db;
    let connection: MongoDbConnection<Collections>;

    beforeAll(() => {
        db = mongo.db(dbName);
        // SAFETY: repositories only use getCollection; this returns real Mongo collections, not a database mock.
        connection = {
            getCollection: <K extends keyof Collections>(name: K) => db.collection<Collections[K]>(name),
        } as unknown as MongoDbConnection<Collections>;
    });

    afterAll(async () => {
        await db.dropDatabase();
        await mongo.close();
    });

    it.each(rows)('$name rejects stale edits without restoring deleted membership', async ({ run }) => {
        await run(connection);
    });

    it('keeps intentional owner sharing updates, including a previously unshared todo', async () => {
        const repository = new MongoTodoRepository(connection);

        const service = new TodoService(repository, { generate: () => 'unused' }, undefined, {
            listFriends: async () => [remaining],
        } as never);

        await repository.insert({ id: 'sharing', ownerId: owner.id, title: 'Share me', done: false, dateAdded });

        expect((await service.updateTodo('sharing', owner.id, { users: [remaining] })).users).toEqual([remaining]);
        expect((await service.updateTodo('sharing', owner.id, { users: [] })).users).toEqual([]);
    });
});
