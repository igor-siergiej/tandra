import { describe, expect, it, vi } from 'bun:test';

import { MongoDiscoveryReportRepository } from './index';

const setup = () => {
    const collection = {
        createIndex: vi.fn(),
        replaceOne: vi.fn(),
        deleteMany: vi.fn(),
        find: vi.fn(() => ({ sort: () => ({ toArray: async () => [] }) })),
    };

    const db = { getCollection: vi.fn(() => collection) };

    return { repo: new MongoDiscoveryReportRepository(db as never), collection, db };
};

describe('MongoDiscoveryReportRepository', () => {
    it('allows one report per reporter per recipe', async () => {
        const { repo, collection } = setup();
        await repo.ensureIndexes();
        expect(collection.createIndex).toHaveBeenCalledWith({ recipeId: 1, reporterId: 1 }, { unique: true });
    });

    it('replaces an earlier report from the same reporter instead of adding another', async () => {
        const { repo, collection } = setup();
        const report = { id: 'x', recipeId: 'user-1', reporterId: 'u1', createdAt: new Date(0) };
        await repo.upsert(report);
        expect(collection.replaceOne).toHaveBeenCalledWith({ recipeId: 'user-1', reporterId: 'u1' }, report, {
            upsert: true,
        });
    });

    it('deletes every report for a recipe', async () => {
        const { repo, collection } = setup();
        await repo.deleteByRecipeId('user-1');
        expect(collection.deleteMany).toHaveBeenCalledWith({ recipeId: 'user-1' });
    });
});
