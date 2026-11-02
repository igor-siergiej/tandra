import type { Logger } from '@imapps/api-utils';
import type { Friendship, PairingCode, User } from '@tandra/types';

import type { FriendRepository } from '../FriendRepository';
import type { IdGenerator } from '../IdGenerator';

const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_LEN = 6;
/** Readable charset — excludes 0/O/1/I. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const err = (message: string, status: number) => Object.assign(new Error(message), { status });

const sortPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

type ItemRepo = { removeMemberFromAll(memberId: string, ownerId: string): Promise<void> };

export class FriendService {
    constructor(
        private readonly repo: FriendRepository,
        private readonly idGenerator: IdGenerator,
        private readonly logger?: Logger,
        private readonly listRepo?: ItemRepo,
        private readonly recipeRepo?: ItemRepo,
        private readonly todoRepo?: ItemRepo,
        private readonly mealPlanRepo?: ItemRepo
    ) {}

    private randomCode(): string {
        let out = '';
        for (let i = 0; i < CODE_LEN; i += 1) {
            out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        }
        return out;
    }

    async generateCode(creatorId: string, creatorUsername: string): Promise<{ code: string; expiresAt: Date }> {
        const code = this.randomCode();
        const expiresAt = new Date(Date.now() + CODE_TTL_MS);
        const pairing: PairingCode = { code, creatorId, creatorUsername, expiresAt };
        await this.repo.insertCode(pairing);
        this.logger?.info('Pairing code generated', { creatorId });
        return { code, expiresAt };
    }

    async redeem(code: string, requesterId: string, requesterUsername: string): Promise<User> {
        const pairing = await this.repo.getCode(code);
        if (!pairing) throw err('Code not found', 404);
        if (pairing.expiresAt.getTime() < Date.now()) throw err('This code has expired', 410);
        if (pairing.usedAt) throw err('This code has already been used', 409);
        if (pairing.creatorId === requesterId) throw err('You cannot redeem your own code', 400);

        const existing = await this.repo.findPair(pairing.creatorId, requesterId);
        if (existing) throw err('You are already friends', 409);

        await this.repo.markCodeUsed(code, new Date());

        const creator: User = { id: pairing.creatorId, username: pairing.creatorUsername };
        const requester: User = { id: requesterId, username: requesterUsername };
        const userIds = sortPair(creator.id, requester.id);
        const users: [User, User] = userIds[0] === creator.id ? [creator, requester] : [requester, creator];
        const friendship: Friendship = { id: this.idGenerator.generate(), userIds, users, createdAt: new Date() };
        await this.repo.insertFriendship(friendship);
        this.logger?.info('Friendship formed', { userIds });
        return creator;
    }

    async listFriends(userId: string): Promise<User[]> {
        const friendships = await this.repo.findByUserId(userId);
        return friendships.map((f) => (f.users[0].id === userId ? f.users[1] : f.users[0]));
    }

    async areFriends(userIdA: string, userIdB: string): Promise<boolean> {
        return (await this.repo.findPair(userIdA, userIdB)) !== null;
    }

    /**
     * Insert a friendship row directly. Used by flows that already established
     * the connection between two users (e.g. the list-invite claim), where
     * generating a pairing code and redeeming it would just be ceremony.
     */
    async createFriendship(userA: User, userB: User): Promise<Friendship> {
        if (userA.id === userB.id) throw err('Cannot friend yourself', 400);
        const existing = await this.repo.findPair(userA.id, userB.id);
        if (existing) return existing;
        const userIds = sortPair(userA.id, userB.id);
        const users: [User, User] = userIds[0] === userA.id ? [userA, userB] : [userB, userA];
        const friendship: Friendship = { id: this.idGenerator.generate(), userIds, users, createdAt: new Date() };
        await this.repo.insertFriendship(friendship);
        this.logger?.info('Friendship created', { userIds });
        return friendship;
    }

    async friendIdsOf(userId: string): Promise<string[]> {
        return (await this.listFriends(userId)).map((u) => u.id);
    }

    async unfriend(userId: string, friendId: string): Promise<void> {
        await this.repo.deletePair(userId, friendId);
        const repos = [this.listRepo, this.recipeRepo, this.todoRepo, this.mealPlanRepo].filter(Boolean) as ItemRepo[];
        // Independent writes on different collections/owners, so they run together rather than one after another.
        await Promise.all(
            repos.flatMap((r) => [
                r.removeMemberFromAll(friendId, userId), // strip friend from userId's items
                r.removeMemberFromAll(userId, friendId), // strip userId from friend's items
            ])
        );
        this.logger?.info('Unfriended (hard revoke)', { userId, friendId });
    }
}
