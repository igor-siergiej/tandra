import { describe, expect, it } from 'bun:test';

import { canonicalPair, MongoFriendRepository } from './index';

describe('canonicalPair', () => {
    it('sorts the two ids lexicographically regardless of argument order', () => {
        expect(canonicalPair('zeb', 'amy')).toEqual(['amy', 'zeb']);
        expect(canonicalPair('amy', 'zeb')).toEqual(['amy', 'zeb']);
    });
});

describe('MongoFriendRepository indexes', () => {
    it('indexes friendships by member and pairing codes by code, keeping the TTL on code expiry', async () => {
        const created: Record<string, unknown[][]> = { friendships: [], pairingCodes: [] };
        const db = {
            getCollection: (name: string) => ({
                createIndex: async (...args: unknown[]) => {
                    created[name].push(args);
                },
            }),
        };

        const repo = new MongoFriendRepository(db as never);
        await repo.ensureIndexes();

        expect(created.friendships).toEqual([[{ userIds: 1 }]]);
        expect(created.pairingCodes).toEqual([[{ expiresAt: 1 }, { expireAfterSeconds: 0 }], [{ code: 1 }]]);
    });
});
