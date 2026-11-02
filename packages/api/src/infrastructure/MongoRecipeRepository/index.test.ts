import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { Recipe, User } from '@tandra/types';

import { MongoRecipeRepository } from './index';

const makeRecipe = (id: string, users: User[] = []): Recipe => ({
    id,
    title: `Recipe ${id}`,
    ingredients: [],
    ownerId: users[0]?.id ?? 'owner',
    users,
    dateAdded: new Date(),
});

const makeMockCollection = () => ({
    findOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndReplace: vi.fn(),
    deleteOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    createIndex: vi.fn(),
});

const makeMockDb = (collection: ReturnType<typeof makeMockCollection>) => ({
    getCollection: vi.fn().mockReturnValue(collection),
});

describe('MongoRecipeRepository', () => {
    let collection: ReturnType<typeof makeMockCollection>;
    let repo: MongoRecipeRepository;

    beforeEach(() => {
        collection = makeMockCollection();
        const db = makeMockDb(collection);
        repo = new MongoRecipeRepository(db as any);
    });

    describe('ensureIndexes', () => {
        it('indexes the fields every recipe lookup filters on', async () => {
            await repo.ensureIndexes();
            expect(collection.createIndex.mock.calls).toEqual([[{ id: 1 }], [{ 'users.id': 1 }]]);
        });
    });

    describe('getById', () => {
        it('returns recipe when found', async () => {
            const recipe = makeRecipe('r1');
            collection.findOne.mockResolvedValue(recipe);
            const result = await repo.getById('r1');
            expect(result).toEqual(recipe);
            expect(collection.findOne).toHaveBeenCalledWith({ id: 'r1' });
        });

        it('returns null when not found', async () => {
            collection.findOne.mockResolvedValue(null);
            const result = await repo.getById('missing');
            expect(result).toBeNull();
        });
    });

    describe('getAll', () => {
        it('returns every recipe in the collection', async () => {
            const recipes = [makeRecipe('r1'), makeRecipe('r2')];
            collection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue(recipes) });
            const result = await repo.getAll();
            expect(result).toEqual(recipes);
            expect(collection.find).toHaveBeenCalledWith({});
        });
    });

    describe('findByUserId', () => {
        it('returns recipes for user', async () => {
            const recipes = [makeRecipe('r1'), makeRecipe('r2')];
            collection.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue(recipes) });
            const result = await repo.findByUserId('user-1');
            expect(result).toEqual(recipes);
            expect(collection.find).toHaveBeenCalledWith({ 'users.id': 'user-1' });
        });
    });

    describe('insert', () => {
        it('inserts and returns the recipe', async () => {
            const recipe = makeRecipe('r1');
            collection.insertOne.mockResolvedValue({});
            const result = await repo.insert(recipe);
            expect(result).toEqual(recipe);
            expect(collection.insertOne).toHaveBeenCalledWith(recipe);
        });
    });

    describe('update', () => {
        it('replaces and returns the updated recipe', async () => {
            const recipe = makeRecipe('r1');
            collection.findOneAndReplace.mockResolvedValue({});
            collection.findOne.mockResolvedValue(recipe);
            const result = await repo.update('r1', recipe);
            expect(result).toEqual(recipe);
        });

        it('throws when recipe not found after replace', async () => {
            const recipe = makeRecipe('r1');
            collection.findOneAndReplace.mockResolvedValue({});
            collection.findOne.mockResolvedValue(null);
            await expect(repo.update('r1', recipe)).rejects.toThrow('Recipe not found');
        });
    });

    describe('deleteById', () => {
        it('deletes recipe by id', async () => {
            collection.deleteOne.mockResolvedValue({ deletedCount: 1 });
            await repo.deleteById('r1');
            expect(collection.deleteOne).toHaveBeenCalledWith({ id: 'r1' });
        });
    });

    describe('addUser', () => {
        it('adds user and returns updated recipe', async () => {
            const user: User = { id: 'u1', username: 'alice' };
            const recipe = makeRecipe('r1', [user]);
            collection.findOneAndUpdate.mockResolvedValue({});
            collection.findOne.mockResolvedValue(recipe);
            const result = await repo.addUser('r1', user);
            expect(result).toEqual(recipe);
        });

        it('throws when recipe not found after update', async () => {
            const user: User = { id: 'u1', username: 'alice' };
            collection.findOneAndUpdate.mockResolvedValue({});
            collection.findOne.mockResolvedValue(null);
            await expect(repo.addUser('r1', user)).rejects.toThrow('Recipe not found');
        });
    });

    describe('removeUser', () => {
        it('removes user and returns updated recipe', async () => {
            const recipe = makeRecipe('r1');
            collection.findOneAndUpdate.mockResolvedValue({});
            collection.findOne.mockResolvedValue(recipe);
            const result = await repo.removeUser('r1', 'u1');
            expect(result).toEqual(recipe);
        });

        it('throws when recipe not found after update', async () => {
            collection.findOneAndUpdate.mockResolvedValue({});
            collection.findOne.mockResolvedValue(null);
            await expect(repo.removeUser('r1', 'u1')).rejects.toThrow('Recipe not found');
        });
    });

    describe('addTags', () => {
        it('adds the tags with $addToSet so existing and concurrent edits survive', async () => {
            collection.findOneAndUpdate.mockResolvedValue({});
            await repo.addTags('r1', ['pasta', 'quick']);
            expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
                { id: 'r1' },
                { $addToSet: { tags: { $each: ['pasta', 'quick'] } } }
            );
        });
    });

    describe('setCoverImageKey', () => {
        it('calls findOneAndUpdate with correct args', async () => {
            collection.findOneAndUpdate.mockResolvedValue({});
            await repo.setCoverImageKey('r1', 'some-key');
            expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
                { id: 'r1' },
                { $set: { coverImageKey: 'some-key' } }
            );
        });
    });
});
