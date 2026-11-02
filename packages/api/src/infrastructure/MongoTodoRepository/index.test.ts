import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { Todo } from '@tandra/types';

import { MongoTodoRepository } from './index';

const makeTodo = (over: Partial<Todo> = {}): Todo => ({
    id: 't1',
    ownerId: 'u1',
    title: 'Task',
    done: false,
    dateAdded: new Date('2026-06-01'),
    ...over,
});

class FakeCollection {
    docs: Todo[] = [];
    indexes: Array<unknown[]> = [];
    async createIndex(...args: unknown[]) {
        this.indexes.push(args);
    }
    async findOne(q: { id: string }) {
        return this.docs.find((d) => d.id === q.id) ?? null;
    }
    find(q: { ownerId?: string }) {
        const matched = this.docs.filter((d) => {
            if (q.ownerId !== undefined && d.ownerId !== q.ownerId) return false;
            return true;
        });
        return { toArray: async () => matched };
    }
    async insertOne(doc: Todo) {
        this.docs.push(doc);
    }
    async findOneAndReplace(q: { id: string }, doc: Todo) {
        const i = this.docs.findIndex((d) => d.id === q.id);
        if (i >= 0) this.docs[i] = doc;
    }
    async deleteOne(q: { id: string }) {
        this.docs = this.docs.filter((d) => d.id !== q.id);
    }
    async updateMany(q: { labelId: string; ownerId: string }, _update: { $unset: { labelId: '' } }) {
        for (const d of this.docs) {
            if (d.labelId === q.labelId && d.ownerId === q.ownerId) {
                delete (d as Partial<Todo>).labelId;
            }
        }
    }
}

const makeDb = (col: FakeCollection) => ({ getCollection: () => col }) as never;

describe('MongoTodoRepository', () => {
    let col: FakeCollection;
    let repo: MongoTodoRepository;

    beforeEach(() => {
        col = new FakeCollection();
        repo = new MongoTodoRepository(makeDb(col));
    });

    it('inserts and gets by id', async () => {
        await repo.insert(makeTodo());
        expect(await repo.getById('t1')).toMatchObject({ id: 't1', title: 'Task' });
    });

    it('returns null for missing id', async () => {
        expect(await repo.getById('nope')).toBeNull();
    });

    it('finds by owner id', async () => {
        await repo.insert(makeTodo({ id: 't1', ownerId: 'u1' }));
        await repo.insert(makeTodo({ id: 't2', ownerId: 'u2' }));
        const mine = await repo.findByOwnerId('u1');
        expect(mine.map((t) => t.id)).toEqual(['t1']);
    });

    it('replaces on update', async () => {
        await repo.insert(makeTodo());
        await repo.update('t1', makeTodo({ title: 'Updated' }));
        expect((await repo.getById('t1'))?.title).toBe('Updated');
    });

    it('deletes by id', async () => {
        await repo.insert(makeTodo());
        await repo.deleteById('t1');
        expect(await repo.getById('t1')).toBeNull();
    });

    it('clears labelId only for matching owner', async () => {
        await repo.insert(makeTodo({ id: 't1', ownerId: 'u1', labelId: 'L' }));
        await repo.insert(makeTodo({ id: 't2', ownerId: 'u2', labelId: 'L' }));
        await repo.clearLabel('L', 'u1');
        expect((await repo.getById('t1'))?.labelId).toBeUndefined();
        expect((await repo.getById('t2'))?.labelId).toBe('L');
    });

    it('findDueCandidates queries incomplete todos due on or before today (day string)', async () => {
        const mockFind = mock(() => ({ toArray: async () => [] }));
        const mockDb = {
            getCollection: () => ({ find: mockFind }),
        } as never;
        const testRepo = new MongoTodoRepository(mockDb);

        await testRepo.findDueCandidates('2026-06-25');

        expect(mockFind).toHaveBeenCalledWith({ done: false, dueDate: { $lte: '2026-06-25' } });
    });

    it('indexes the lookups it filters on: id, owner, member, and the reminder scan', async () => {
        await repo.ensureIndexes();

        expect(col.indexes).toEqual([[{ id: 1 }], [{ ownerId: 1 }], [{ 'users.id': 1 }], [{ done: 1, dueDate: 1 }]]);
    });
});
