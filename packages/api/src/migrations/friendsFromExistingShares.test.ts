import { describe, expect, it } from 'bun:test';

import type { Friendship } from '@tandra/types';

import { migrateFriendsFromExistingShares, pairsFromItems } from './friendsFromExistingShares';

describe('pairsFromItems', () => {
    it('emits an owner↔member pair for each shared member, deduped and canonical', () => {
        const items = [
            {
                ownerId: 'u1',
                users: [
                    { id: 'u1', username: 'a' },
                    { id: 'u2', username: 'b' },
                ],
            },
            {
                ownerId: 'u1',
                users: [
                    { id: 'u1', username: 'a' },
                    { id: 'u2', username: 'b' },
                ],
            }, // dup
            {
                ownerId: 'u1',
                users: [
                    { id: 'u1', username: 'a' },
                    { id: 'u3', username: 'c' },
                ],
            },
        ];

        const pairs = pairsFromItems(items as never);
        expect(pairs.map((p) => p.userIds)).toEqual([
            ['u1', 'u2'],
            ['u1', 'u3'],
        ]);
    });

    it('ignores unshared items (single user) and the owner-self entry', () => {
        const items = [{ ownerId: 'u1', users: [{ id: 'u1', username: 'a' }] }];
        expect(pairsFromItems(items as never)).toEqual([]);
    });
});

describe('migrateFriendsFromExistingShares', () => {
    const u1 = { id: 'u1', username: 'a' };
    const u2 = { id: 'u2', username: 'b' };
    const u3 = { id: 'u3', username: 'c' };

    it('creates a friendship for each new pair found across lists and recipes', async () => {
        const inserted: Friendship[] = [];

        const result = await migrateFriendsFromExistingShares({
            listRepo: { getAll: async () => [{ ownerId: 'u1', users: [u1, u2] }] },
            recipeRepo: { getAll: async () => [{ ownerId: 'u1', users: [u1, u3] }] },
            friendRepo: {
                findPair: async () => null,
                insertFriendship: async (f) => {
                    inserted.push(f);
                },
            },
            idGenerator: { generate: () => 'generated-id' },
        });

        expect(result).toEqual({ created: 2 });
        expect(inserted.map((f) => f.userIds)).toEqual([
            ['u1', 'u2'],
            ['u1', 'u3'],
        ]);
    });

    it('is idempotent — skips a pair when findPair already returns a friendship', async () => {
        const existing: Friendship = {
            id: 'existing',
            userIds: ['u1', 'u2'],
            users: [u1, u2],
            createdAt: new Date(),
        };

        const inserted: Friendship[] = [];

        const result = await migrateFriendsFromExistingShares({
            listRepo: { getAll: async () => [{ ownerId: 'u1', users: [u1, u2] }] },
            recipeRepo: { getAll: async () => [] },
            friendRepo: {
                findPair: async () => existing,
                insertFriendship: async (f) => {
                    inserted.push(f);
                },
            },
            idGenerator: { generate: () => 'generated-id' },
        });

        expect(result).toEqual({ created: 0 });
        expect(inserted).toEqual([]);
    });
});
