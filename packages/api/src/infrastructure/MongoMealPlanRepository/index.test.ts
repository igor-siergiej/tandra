import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { MongoMealPlanRepository } from './index';

const cursor = { sort: vi.fn(), toArray: vi.fn() };

cursor.sort.mockReturnValue(cursor);

const collection = {
    createIndex: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue(cursor),
    insertOne: vi.fn(),
    findOneAndReplace: vi.fn(),
    deleteOne: vi.fn(),
    updateMany: vi.fn(),
};

const repo = new MongoMealPlanRepository({ getCollection: () => collection } as never);
const entry = { id: 'e1', ownerId: 'u1', date: '2026-10-12', recipeId: 'r1', servings: 2, dateAdded: new Date() };

describe('MongoMealPlanRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cursor.sort.mockReturnValue(cursor);
        collection.find.mockReturnValue(cursor);
    });

    it('indexes by id, owner+date and member+date', async () => {
        await repo.ensureIndexes();

        expect(collection.createIndex.mock.calls).toEqual([
            [{ id: 1 }, { unique: true }],
            [{ ownerId: 1, date: 1 }],
            [{ 'users.id': 1, date: 1 }],
        ]);
    });

    it('finds owned or shared entries in a date window, oldest first', async () => {
        cursor.toArray.mockResolvedValue([entry]);

        expect(await repo.findForUserBetween('u1', '2026-10-12', '2026-10-18')).toEqual([entry]);
        expect(collection.find).toHaveBeenCalledWith({
            date: { $gte: '2026-10-12', $lte: '2026-10-18' },
            $or: [{ ownerId: 'u1' }, { 'users.id': 'u1' }],
        });
        expect(cursor.sort).toHaveBeenCalledWith({ date: 1 });
    });

    it('inserts, replaces and deletes by id', async () => {
        await repo.insert(entry);
        expect(collection.insertOne).toHaveBeenCalledWith(entry);

        collection.findOne.mockResolvedValue(entry);
        expect(await repo.update('e1', entry)).toEqual(entry);
        expect(collection.findOneAndReplace).toHaveBeenCalledWith({ id: 'e1' }, entry);

        await repo.deleteById('e1');
        expect(collection.deleteOne).toHaveBeenCalledWith({ id: 'e1' });
    });

    it('throws when an updated entry has vanished', async () => {
        collection.findOne.mockResolvedValue(null);

        await expect(repo.update('e1', entry)).rejects.toThrow('Meal plan entry not found');
    });

    it('strips a former friend from every entry the owner has', async () => {
        await repo.removeMemberFromAll('u2', 'u1');

        expect(collection.updateMany).toHaveBeenCalledWith({ ownerId: 'u1' }, { $pull: { users: { id: 'u2' } } });
    });
});
