import { beforeEach, describe, expect, it } from 'bun:test';

import type { Label } from '@tandra/types';

import { connectionTo } from '../../testing/fake';
import { MongoLabelRepository } from './index';

const makeLabel = (over: Partial<Label> = {}): Label => ({
    id: 'L1',
    ownerId: 'u1',
    name: 'Work',
    color: '#3b82f6',
    ...over,
});

class FakeCollection {
    docs: Label[] = [];
    indexes: Array<unknown[]> = [];
    async createIndex(...args: unknown[]) {
        this.indexes.push(args);
    }
    async findOne(q: { id: string }) {
        return this.docs.find((d) => d.id === q.id) ?? null;
    }
    find(q: { ownerId: string }) {
        const matched = this.docs.filter((d) => d.ownerId === q.ownerId);

        return { toArray: async () => matched };
    }
    async insertOne(doc: Label) {
        this.docs.push(doc);
    }
    async findOneAndReplace(q: { id: string }, doc: Label) {
        const i = this.docs.findIndex((d) => d.id === q.id);

        if (i >= 0) this.docs[i] = doc;
    }
    async deleteOne(q: { id: string }) {
        this.docs = this.docs.filter((d) => d.id !== q.id);
    }
}

const makeDb = (col: FakeCollection) => connectionTo(col);

describe('MongoLabelRepository', () => {
    let col: FakeCollection;
    let repo: MongoLabelRepository;

    beforeEach(() => {
        col = new FakeCollection();
        repo = new MongoLabelRepository(makeDb(col));
    });

    it('inserts and gets by id', async () => {
        await repo.insert(makeLabel());
        expect(await repo.getById('L1')).toMatchObject({ name: 'Work', color: '#3b82f6' });
    });

    it('finds by owner', async () => {
        await repo.insert(makeLabel({ id: 'L1', ownerId: 'u1' }));
        await repo.insert(makeLabel({ id: 'L2', ownerId: 'u2' }));
        expect((await repo.findByOwnerId('u1')).map((l) => l.id)).toEqual(['L1']);
    });

    it('updates and deletes', async () => {
        await repo.insert(makeLabel());
        await repo.update('L1', makeLabel({ name: 'Home', color: '#22c55e' }));
        expect((await repo.getById('L1'))?.name).toBe('Home');
        await repo.deleteById('L1');
        expect(await repo.getById('L1')).toBeNull();
    });

    it('indexes id and owner', async () => {
        await repo.ensureIndexes();

        expect(col.indexes).toEqual([[{ id: 1 }], [{ ownerId: 1 }]]);
    });
});
