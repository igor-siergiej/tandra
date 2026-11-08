import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { connectionTo } from '../../testing/fake';
import { MongoItemCategoryRepository } from './index';

const collection = { createIndex: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() };
const repo = new MongoItemCategoryRepository(connectionTo(collection));

describe('MongoItemCategoryRepository', () => {
    beforeEach(() => vi.clearAllMocks());

    it('builds a unique index on name', async () => {
        await repo.ensureIndexes();
        expect(collection.createIndex).toHaveBeenCalledWith({ name: 1 }, { unique: true });
    });

    it('returns the stored category or null', async () => {
        collection.findOne.mockResolvedValueOnce({ name: 'milk', category: 'dairy' });
        expect(await repo.get('milk')).toBe('dairy');

        collection.findOne.mockResolvedValueOnce(null);
        expect(await repo.get('kale')).toBeNull();
    });

    it('upserts without overwriting an existing answer', async () => {
        await repo.set('milk', 'dairy');
        expect(collection.updateOne).toHaveBeenCalledWith(
            { name: 'milk' },
            { $setOnInsert: { name: 'milk', category: 'dairy' } },
            { upsert: true }
        );
    });
});
