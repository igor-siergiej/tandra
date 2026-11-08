import { describe, expect, it } from 'bun:test';

import type { CreateIndexesOptions, IndexSpecification } from 'mongodb';

import { connectionTo } from '../../testing/fake';
import { canonicalPair, MongoFriendRepository } from './index';

describe('canonicalPair', () => {
    it('sorts the two ids lexicographically regardless of argument order', () => {
        expect(canonicalPair('zeb', 'amy')).toEqual(['amy', 'zeb']);
        expect(canonicalPair('amy', 'zeb')).toEqual(['amy', 'zeb']);
    });
});

type IndexCall = [IndexSpecification, CreateIndexesOptions?];

describe('MongoFriendRepository indexes', () => {
    it('indexes friendships by member and pairing codes by code, keeping the TTL on code expiry', async () => {
        const opened: string[] = [];
        const created = { friendships: new Array<IndexCall>(), pairingCodes: new Array<IndexCall>() };

        const collection = {
            // The repository opens a collection and indexes it straight away, so the last name opened owns the call.
            createIndex: async (...args: IndexCall) => {
                if (opened.at(-1) === 'friendships') created.friendships.push(args);

                if (opened.at(-1) === 'pairingCodes') created.pairingCodes.push(args);
            },
        };

        const repo = new MongoFriendRepository(connectionTo(collection, opened));
        await repo.ensureIndexes();

        expect(created.friendships).toEqual([[{ userIds: 1 }]]);
        expect(created.pairingCodes).toEqual([[{ expiresAt: 1 }, { expireAfterSeconds: 0 }], [{ code: 1 }]]);
    });
});
