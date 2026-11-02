import { describe, expect, it } from 'bun:test';

import type { Friendship, PairingCode } from '@tandra/types';

import { FriendService } from './index';

class MockRepo {
    codes = new Map<string, PairingCode>();
    friendships: Friendship[] = [];
    async insertCode(c: PairingCode) {
        this.codes.set(c.code, c);
    }
    async getCode(code: string) {
        return this.codes.get(code) ?? null;
    }
    async markCodeUsed(code: string, usedAt: Date) {
        const c = this.codes.get(code);

        if (c) c.usedAt = usedAt;
    }
    async insertFriendship(f: Friendship) {
        this.friendships.push(f);
    }
    async findByUserId(userId: string) {
        return this.friendships.filter((f) => f.userIds.includes(userId));
    }
    async findPair(a: string, b: string) {
        const key = [a, b].sort();

        return this.friendships.find((f) => f.userIds[0] === key[0] && f.userIds[1] === key[1]) ?? null;
    }
    async deletePair(a: string, b: string) {
        const key = [a, b].sort();
        this.friendships = this.friendships.filter((f) => !(f.userIds[0] === key[0] && f.userIds[1] === key[1]));
    }
}

class MockIds {
    private n = 0;
    generate() {
        this.n += 1;

        return `id-${this.n}`;
    }
}

class MockItemRepo {
    calls: Array<{ memberId: string; ownerId: string }> = [];
    async removeMemberFromAll(memberId: string, ownerId: string) {
        this.calls.push({ memberId, ownerId });
    }
}

const svcWith = (repo: MockRepo) => new FriendService(repo as never, new MockIds() as never);

describe('FriendService.generateCode', () => {
    it('creates a single-use code with a 15-minute expiry', async () => {
        const repo = new MockRepo();
        const before = Date.now();
        const { code, expiresAt } = await svcWith(repo).generateCode('u1', 'alice');
        expect(code).toMatch(/^[A-Z2-9]{6}$/); // readable charset, no 0/O/1/I
        const stored = repo.codes.get(code)!;
        expect(stored.creatorId).toBe('u1');
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 1000);
    });
});

describe('FriendService.redeem', () => {
    const seedCode = (repo: MockRepo, over: Partial<PairingCode> = {}) => {
        const c: PairingCode = {
            code: 'ABC234',
            creatorId: 'u1',
            creatorUsername: 'alice',
            expiresAt: new Date(Date.now() + 60_000),
            ...over,
        };

        repo.codes.set(c.code, c);

        return c;
    };

    it('forms a mutual friendship and returns the new friend', async () => {
        const repo = new MockRepo();
        seedCode(repo);
        const friend = await svcWith(repo).redeem('ABC234', 'u2', 'bob');
        expect(friend).toEqual({ id: 'u1', username: 'alice' });
        expect(repo.friendships).toHaveLength(1);
        expect(repo.codes.get('ABC234')?.usedAt).toBeInstanceOf(Date);
    });

    it('404 when the code does not exist', async () => {
        const repo = new MockRepo();
        await expect(svcWith(repo).redeem('NOPE22', 'u2', 'bob')).rejects.toMatchObject({ status: 404 });
    });

    it('410 when the code is expired', async () => {
        const repo = new MockRepo();
        seedCode(repo, { expiresAt: new Date(Date.now() - 1000) });
        await expect(svcWith(repo).redeem('ABC234', 'u2', 'bob')).rejects.toMatchObject({ status: 410 });
    });

    it('409 when the code was already used', async () => {
        const repo = new MockRepo();
        seedCode(repo, { usedAt: new Date() });
        await expect(svcWith(repo).redeem('ABC234', 'u2', 'bob')).rejects.toMatchObject({ status: 409 });
    });

    it('400 when redeeming your own code', async () => {
        const repo = new MockRepo();
        seedCode(repo);
        await expect(svcWith(repo).redeem('ABC234', 'u1', 'alice')).rejects.toMatchObject({ status: 400 });
    });

    it('409 when the two are already friends', async () => {
        const repo = new MockRepo();
        seedCode(repo);
        repo.friendships.push({
            id: 'f1',
            userIds: ['u1', 'u2'],
            users: [
                { id: 'u1', username: 'alice' },
                { id: 'u2', username: 'bob' },
            ],
            createdAt: new Date(),
        });
        await expect(svcWith(repo).redeem('ABC234', 'u2', 'bob')).rejects.toMatchObject({ status: 409 });
    });
});

describe('FriendService.listFriends / unfriend / areFriends / friendIdsOf', () => {
    const seedFriendship = (repo: MockRepo) =>
        repo.friendships.push({
            id: 'f1',
            userIds: ['u1', 'u2'],
            users: [
                { id: 'u1', username: 'alice' },
                { id: 'u2', username: 'bob' },
            ],
            createdAt: new Date(),
        });

    it('returns the other party of each friendship', async () => {
        const repo = new MockRepo();
        seedFriendship(repo);
        expect(await svcWith(repo).listFriends('u1')).toEqual([{ id: 'u2', username: 'bob' }]);
        expect(await svcWith(repo).listFriends('u2')).toEqual([{ id: 'u1', username: 'alice' }]);
    });

    it('areFriends / friendIdsOf reflect the graph', async () => {
        const repo = new MockRepo();
        seedFriendship(repo);
        expect(await svcWith(repo).areFriends('u1', 'u2')).toBe(true);
        expect(await svcWith(repo).areFriends('u1', 'u9')).toBe(false);
        expect(await svcWith(repo).friendIdsOf('u1')).toEqual(['u2']);
    });

    it('unfriend removes the pair', async () => {
        const repo = new MockRepo();
        seedFriendship(repo);
        await svcWith(repo).unfriend('u1', 'u2');
        expect(repo.friendships).toHaveLength(0);
    });

    it('unfriend strips the ex-friend from all items both directions', async () => {
        const repo = new MockRepo();
        seedFriendship(repo);
        const lists = new MockItemRepo();
        const recipes = new MockItemRepo();
        const todos = new MockItemRepo();

        const svc = new FriendService(
            repo as never,
            new MockIds() as never,
            undefined,
            lists as never,
            recipes as never,
            todos as never
        );

        await svc.unfriend('u1', 'u2');

        for (const r of [lists, recipes, todos]) {
            expect(r.calls).toEqual(
                expect.arrayContaining([
                    { memberId: 'u2', ownerId: 'u1' },
                    { memberId: 'u1', ownerId: 'u2' },
                ])
            );
        }

        expect(repo.friendships).toHaveLength(0);
    });

    it('unfriend starts every cleanup write before waiting for any of them', async () => {
        const repo = new MockRepo();
        seedFriendship(repo);
        const started: string[] = [];
        let release: () => void = () => {};

        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        const slowRepo = (name: string) => ({
            removeMemberFromAll: async (memberId: string) => {
                started.push(`${name}:${memberId}`);
                await gate;
            },
        });

        const svc = new FriendService(
            repo as never,
            new MockIds() as never,
            undefined,
            slowRepo('lists') as never,
            slowRepo('recipes') as never,
            slowRepo('todos') as never,
            slowRepo('mealPlan') as never
        );

        const done = svc.unfriend('u1', 'u2');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(started).toHaveLength(8);
        release();
        await done;
    });
});
