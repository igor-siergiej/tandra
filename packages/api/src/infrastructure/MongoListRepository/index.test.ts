import { beforeEach, describe, expect, it } from 'bun:test';

import type { MongoDbConnection } from '@imapps/api-utils';
import type { Item, List } from '@tandra/types';
import type { Document, Filter, IndexSpecification, UpdateFilter, UpdateOptions } from 'mongodb';

import type { Collections } from '../../dependencies/types';
import { fake } from '../../testing/fake';
import { MongoListRepository } from './index';

type Query = Filter<List>;

type Update = UpdateFilter<List> | Document[];

/** Every call the double saw, by method, in the argument order the driver takes. */
type Calls = {
    findOne: Array<[Query]>;
    find: Array<[Query]>;
    insertOne: Array<[List]>;
    deleteOne: Array<[Query]>;
    replaceOne: Array<[Query, List]>;
    updateOne: Array<[Query, Update] | [Query, Update, UpdateOptions]>;
    findOneAndReplace: Array<[Query, List]>;
    findOneAndUpdate: Array<[Query, Update]>;
};

/** What each method resolves with; the repository reads only these fields of a driver result. */
type Resolved = {
    findOne: List | null;
    find: { toArray: () => Promise<List[]> };
    insertOne: { insertedId: string | null };
    deleteOne: { deletedCount: number };
    replaceOne: { matchedCount?: number; modifiedCount?: number };
    updateOne: { modifiedCount: number };
    findOneAndReplace: { modifiedCount: number };
    findOneAndUpdate: { modifiedCount: number };
};

const emptyCalls = (): Calls => ({
    findOne: [],
    find: [],
    insertOne: [],
    deleteOne: [],
    replaceOne: [],
    updateOne: [],
    findOneAndReplace: [],
    findOneAndUpdate: [],
});

const defaultResolved = (): Resolved => ({
    findOne: null,
    find: { toArray: async () => [] },
    insertOne: { insertedId: null },
    deleteOne: { deletedCount: 0 },
    replaceOne: { modifiedCount: 0 },
    updateOne: { modifiedCount: 0 },
    findOneAndReplace: { modifiedCount: 0 },
    findOneAndUpdate: { modifiedCount: 0 },
});

class MockCollection {
    calls = emptyCalls();

    resolvedValues = defaultResolved();

    /** When set, successive findOne calls return these in order (then fall back to resolvedValues.findOne). */
    findOneSequence: Array<List | null> = [];

    async findOne(query: Query) {
        this.calls.findOne.push([query]);

        if (this.findOneSequence.length > 0) return this.findOneSequence.shift();

        return this.resolvedValues.findOne;
    }

    find(query: Query) {
        this.calls.find.push([query]);

        return this.resolvedValues.find;
    }

    async insertOne(doc: List) {
        this.calls.insertOne.push([doc]);

        return this.resolvedValues.insertOne;
    }

    async deleteOne(query: Query) {
        this.calls.deleteOne.push([query]);

        return this.resolvedValues.deleteOne;
    }

    async replaceOne(query: Query, replacement: List) {
        this.calls.replaceOne.push([query, replacement]);

        return this.resolvedValues.replaceOne;
    }

    async updateOne(query: Query, update: Update, options?: UpdateOptions) {
        this.calls.updateOne.push(options === undefined ? [query, update] : [query, update, options]);

        return this.resolvedValues.updateOne;
    }

    async findOneAndReplace(query: Query, replacement: List) {
        this.calls.findOneAndReplace.push([query, replacement]);

        return this.resolvedValues.findOneAndReplace;
    }

    async findOneAndUpdate(query: Query, update: Update) {
        this.calls.findOneAndUpdate.push([query, update]);

        return this.resolvedValues.findOneAndUpdate;
    }

    createIndexCalls: Array<IndexSpecification> = [];

    async createIndex(keys: IndexSpecification) {
        this.createIndexCalls.push(keys);

        return 'index';
    }

    updateManyCalls: Array<[Query, Update]> = [];

    async updateMany(query: Query, update: Update) {
        this.updateManyCalls.push([query, update]);

        return { modifiedCount: 1 };
    }

    reset() {
        this.findOneSequence = [];
        this.createIndexCalls = [];
        this.updateManyCalls = [];
        this.calls = emptyCalls();
        this.resolvedValues = defaultResolved();
    }
}

const mockCollection = new MockCollection();

// SAFETY: MockCollection implements every collection method MongoListRepository calls (findOne, find, insertOne,
// deleteOne, replaceOne, updateOne, findOneAndReplace, findOneAndUpdate, createIndex, updateMany).
const mockConnection = fake<MongoDbConnection<Collections>>({ getCollection: () => mockCollection as never });

describe('MongoListRepository', () => {
    let repository: MongoListRepository;

    beforeEach(() => {
        mockCollection.reset();
        repository = new MongoListRepository(mockConnection);
    });

    describe('Ensuring indexes', () => {
        it('indexes the fields every list lookup filters on', async () => {
            await repository.ensureIndexes();

            expect(mockCollection.createIndexCalls).toEqual([{ id: 1 }, { title: 1 }, { 'users.id': 1 }]);
        });
    });

    describe('Resolving a list reference', () => {
        const mockList: List = {
            id: 'list-1',
            title: 'Test List',
            dateAdded: new Date('2023-01-01'),
            items: [],
            users: [{ id: 'user-1', username: 'testuser' }],
        };

        it('finds a list by its id first', async () => {
            mockCollection.findOneSequence = [mockList];

            const result = await repository.getByRef('list-1');

            expect(mockCollection.calls.findOne).toEqual([[{ id: 'list-1' }]]);
            expect(result).toEqual(mockList);
        });

        it('falls back to the title for links and queued offline intents made before ids were used', async () => {
            mockCollection.findOneSequence = [null, mockList];

            const result = await repository.getByRef('Test List');

            expect(mockCollection.calls.findOne).toEqual([[{ id: 'Test List' }], [{ title: 'Test List' }]]);
            expect(result).toEqual(mockList);
        });

        it('returns null when neither an id nor a title matches', async () => {
            mockCollection.findOneSequence = [null, null];

            expect(await repository.getByRef('Non-existent List')).toBeNull();
        });
    });

    describe('Getting all lists', () => {
        it('should return every list in the collection', async () => {
            const mockLists: Array<List> = [
                {
                    id: 'list-1',
                    title: 'List 1',
                    dateAdded: new Date('2023-01-01'),
                    items: [],
                    users: [{ id: 'user-1', username: 'testuser' }],
                },
            ];

            mockCollection.resolvedValues.find = { toArray: async () => mockLists };

            const result = await repository.getAll();

            expect(mockCollection.calls.find[0]).toEqual([{}]);
            expect(result).toEqual(mockLists);
        });
    });

    describe('Finding lists by user ID', () => {
        describe('When a user has lists', () => {
            it('should return all lists belonging to that user', async () => {
                const mockLists: Array<List> = [
                    {
                        id: 'list-1',
                        title: 'List 1',
                        dateAdded: new Date('2023-01-01'),
                        items: [],
                        users: [{ id: 'user-1', username: 'testuser' }],
                    },
                ];

                const mockCursor = {
                    toArray: async () => mockLists,
                };

                mockCollection.resolvedValues.find = mockCursor;

                const result = await repository.findByUserId('user-1');

                expect(mockCollection.calls.find[0]).toEqual([{ 'users.id': 'user-1' }]);
                expect(result).toEqual(mockLists);
            });
        });

        describe('When a user has no lists', () => {
            it('should return an empty array', async () => {
                const mockCursor = {
                    toArray: async () => [],
                };

                mockCollection.resolvedValues.find = mockCursor;

                const result = await repository.findByUserId('non-existent-user');

                expect(result).toEqual([]);
            });
        });
    });

    describe('Inserting new lists', () => {
        describe('When inserting a new list', () => {
            it('should save the list to the database', async () => {
                const mockList: List = {
                    id: 'list-1',
                    title: 'Test List',
                    dateAdded: new Date('2023-01-01'),
                    items: [],
                    users: [{ id: 'user-1', username: 'testuser' }],
                };

                mockCollection.resolvedValues.insertOne = { insertedId: 'list-1' };

                await repository.insert(mockList);

                expect(mockCollection.calls.insertOne[0]).toEqual([mockList]);
            });
        });
    });

    describe('Deleting lists by id', () => {
        describe('When deleting a list by id', () => {
            it('should remove the list from the database', async () => {
                mockCollection.resolvedValues.deleteOne = { deletedCount: 1 };

                await repository.deleteById('list-1');

                expect(mockCollection.calls.deleteOne[0]).toEqual([{ id: 'list-1' }]);
            });
        });
    });

    describe('Replacing lists when unchanged', () => {
        const mockList: List = {
            id: 'list-1',
            title: 'Updated List',
            dateAdded: new Date('2023-01-01'),
            items: [],
            users: [{ id: 'user-1', username: 'testuser' }],
            revision: 4,
        };

        it('writes only if the revision it read is still current, and returns the next one', async () => {
            mockCollection.resolvedValues.replaceOne = { matchedCount: 1 };

            const next = await repository.replaceIfUnchanged('list-1', mockList);

            expect(next).toBe(5);
            expect(mockCollection.calls.replaceOne[0]).toEqual([
                { id: 'list-1', revision: 4 },
                { ...mockList, revision: 5 },
            ]);
        });

        it('matches a list that predates revisions by the field being absent', async () => {
            mockCollection.resolvedValues.replaceOne = { matchedCount: 1 };
            const { revision: _revision, ...legacy } = mockList;

            const next = await repository.replaceIfUnchanged('list-1', legacy);

            expect(next).toBe(1);
            expect(mockCollection.calls.replaceOne[0][0]).toEqual({ id: 'list-1', revision: { $exists: false } });
        });

        it('reports null when the list changed or was deleted since it was read', async () => {
            mockCollection.resolvedValues.replaceOne = { matchedCount: 0 };

            expect(await repository.replaceIfUnchanged('list-1', mockList)).toBeNull();
        });
    });

    describe('Adding items to lists', () => {
        describe('When adding an item to a list', () => {
            it('should add the item to the list in the database', async () => {
                const mockItem: Item = {
                    id: 'item-1',
                    name: 'Test Item',
                    dateAdded: new Date('2023-01-01'),
                    isSelected: false,
                };

                mockCollection.resolvedValues.findOneAndUpdate = { modifiedCount: 1 };

                await repository.pushItem('list-1', mockItem);

                expect(mockCollection.calls.findOneAndUpdate[0]).toEqual([
                    { id: 'list-1' },
                    { $push: { items: mockItem }, $inc: { revision: 1 } },
                ]);
            });
        });
    });

    describe('Setting an item category only while unset', () => {
        it('filters on the item having no category so a user choice is never overwritten', async () => {
            mockCollection.resolvedValues.updateOne = { modifiedCount: 1 };

            const changed = await repository.setCategoryIfUnset('list-1', 'item-1', 'dairy');

            expect(changed).toBe(true);
            expect(mockCollection.calls.updateOne[0]).toEqual([
                { id: 'list-1' },
                { $set: { 'items.$[item].category': 'dairy' }, $inc: { revision: 1 } },
                { arrayFilters: [{ 'item.id': 'item-1', 'item.category': { $exists: false } }] },
            ]);
        });

        it('reports false when nothing was modified', async () => {
            mockCollection.resolvedValues.updateOne = { modifiedCount: 0 };

            expect(await repository.setCategoryIfUnset('list-1', 'item-1', 'dairy')).toBe(false);
        });
    });

    describe('Removing a member from every list an owner has', () => {
        it('bumps the revision so a concurrent read-modify-write cannot bring the member back', async () => {
            await repository.removeMemberFromAll('friend-1', 'owner-1');

            expect(mockCollection.updateManyCalls).toEqual([
                [{ ownerId: 'owner-1' }, { $pull: { users: { id: 'friend-1' } }, $inc: { revision: 1 } }],
            ]);
        });
    });
});
