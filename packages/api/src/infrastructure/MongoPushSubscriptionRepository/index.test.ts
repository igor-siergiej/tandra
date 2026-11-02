import { beforeEach, describe, expect, it } from 'bun:test';

import type { PushSubscription } from '@tandra/types';

import { MongoPushSubscriptionRepository } from './index';

class FakeCollection {
    docs: PushSubscription[] = [];
    indexes: Array<unknown[]> = [];
    async createIndex(...args: unknown[]) {
        this.indexes.push(args);
    }

    async replaceOne(filter: { endpoint: string }, doc: PushSubscription, opts: { upsert: boolean }) {
        const idx = this.docs.findIndex((d) => d.endpoint === filter.endpoint);
        if (idx >= 0) {
            this.docs[idx] = doc;
        } else if (opts.upsert) {
            this.docs.push(doc);
        }
    }

    async deleteOne(filter: { endpoint: string }) {
        this.docs = this.docs.filter((d) => d.endpoint !== filter.endpoint);
    }

    async deleteMany(filter: { endpoint: { $in: string[] } }) {
        this.docs = this.docs.filter((d) => !filter.endpoint.$in.includes(d.endpoint));
    }

    find(filter: { userId: { $in: string[] } }) {
        const matched = this.docs.filter((d) => filter.userId.$in.includes(d.userId));
        return { toArray: async () => matched };
    }
}

const makeSub = (endpoint: string, userId: string): PushSubscription => ({
    endpoint,
    userId,
    keys: { p256dh: 'p', auth: 'a' },
    dateAdded: new Date(),
});

describe('MongoPushSubscriptionRepository', () => {
    let collection: FakeCollection;
    let repo: MongoPushSubscriptionRepository;

    beforeEach(() => {
        collection = new FakeCollection();
        const db = { getCollection: () => collection } as never;
        repo = new MongoPushSubscriptionRepository(db);
    });

    it('indexes endpoint and user id', async () => {
        await repo.ensureIndexes();

        expect(collection.indexes).toEqual([[{ endpoint: 1 }], [{ userId: 1 }]]);
    });

    it('upserts by endpoint (no duplicates)', async () => {
        await repo.upsert(makeSub('e1', 'u1'));
        await repo.upsert(makeSub('e1', 'u1'));
        expect(collection.docs.length).toBe(1);
    });

    it('finds subscriptions for the given user ids', async () => {
        await repo.upsert(makeSub('e1', 'u1'));
        await repo.upsert(makeSub('e2', 'u2'));
        await repo.upsert(makeSub('e3', 'u3'));
        const found = await repo.findByUserIds(['u1', 'u3']);
        expect(found.map((s) => s.endpoint).sort()).toEqual(['e1', 'e3']);
    });

    it('deletes by endpoint', async () => {
        await repo.upsert(makeSub('e1', 'u1'));
        await repo.deleteByEndpoint('e1');
        expect(collection.docs.length).toBe(0);
    });

    it('bulk-deletes by endpoints', async () => {
        await repo.upsert(makeSub('e1', 'u1'));
        await repo.upsert(makeSub('e2', 'u1'));
        await repo.deleteByEndpoints(['e1', 'e2']);
        expect(collection.docs.length).toBe(0);
    });
});
