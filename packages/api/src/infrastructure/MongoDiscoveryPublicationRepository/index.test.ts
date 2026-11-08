import { describe, expect, it, vi } from 'bun:test';

import { connectionTo } from '../../testing/fake';
import { MongoDiscoveryPublicationRepository } from './index';

const setup = () => {
    const collection = {
        createIndex: vi.fn(),
        findOne: vi.fn(async () => null),
        find: vi.fn(() => ({ toArray: async () => [] })),
        replaceOne: vi.fn(),
        deleteOne: vi.fn(),
    };

    const opened: string[] = [];

    return { repo: new MongoDiscoveryPublicationRepository(connectionTo(collection, opened)), collection, opened };
};

describe('MongoDiscoveryPublicationRepository', () => {
    it('keeps the back-reference in its own collection, never on the public library documents', async () => {
        const { repo, opened } = setup();
        await repo.getByRecipeId('r1');
        expect(opened).toContain('discoveryPublications');
    });

    it('guarantees one publication per personal recipe and one per library recipe', async () => {
        const { repo, collection } = setup();
        await repo.ensureIndexes();
        expect(collection.createIndex).toHaveBeenCalledWith({ recipeId: 1 }, { unique: true });
        expect(collection.createIndex).toHaveBeenCalledWith({ libraryId: 1 }, { unique: true });
    });

    it('lists only finished publications of the owner', async () => {
        const { repo, collection } = setup();
        await repo.listPublishedByOwner('u1');
        expect(collection.find).toHaveBeenCalledWith(
            { ownerId: 'u1', publishedAt: { $exists: true } },
            { projection: { _id: 0 } }
        );
    });

    it('upserts by personal recipe id so a retry replaces the half-finished row', async () => {
        const { repo, collection } = setup();
        const row = { recipeId: 'r1', libraryId: 'user-1', ownerId: 'u1' };
        await repo.upsert(row);
        expect(collection.replaceOne).toHaveBeenCalledWith({ recipeId: 'r1' }, row, { upsert: true });
    });
});
