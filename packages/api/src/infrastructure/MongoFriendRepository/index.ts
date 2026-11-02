import type { MongoDbConnection } from '@imapps/api-utils';
import type { Friendship, PairingCode } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { FriendRepository } from '../../domain/FriendRepository';

/** Lexicographically-sorted pair so a friendship has one canonical row. */
export const canonicalPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export class MongoFriendRepository implements FriendRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {
        void this.codes().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    }

    private friendships() {
        return this.db.getCollection(CollectionNames.Friendship);
    }

    private codes() {
        return this.db.getCollection(CollectionNames.PairingCode);
    }

    // friendships are looked up by member (userIds) and pairing codes by their code; the TTL index on codes is
    // created in the constructor.
    async ensureIndexes(): Promise<void> {
        await this.friendships().createIndex({ userIds: 1 });
        await this.codes().createIndex({ code: 1 });
    }

    async insertCode(code: PairingCode): Promise<void> {
        await this.codes().insertOne(code);
    }

    async getCode(code: string): Promise<PairingCode | null> {
        return this.codes().findOne({ code });
    }

    async markCodeUsed(code: string, usedAt: Date): Promise<void> {
        await this.codes().updateOne({ code }, { $set: { usedAt } });
    }

    async insertFriendship(friendship: Friendship): Promise<void> {
        await this.friendships().insertOne(friendship);
    }

    async findByUserId(userId: string): Promise<Friendship[]> {
        return this.friendships().find({ userIds: userId }).toArray();
    }

    async findPair(userIdA: string, userIdB: string): Promise<Friendship | null> {
        const userIds = canonicalPair(userIdA, userIdB);

        return this.friendships().findOne({ userIds });
    }

    async deletePair(userIdA: string, userIdB: string): Promise<void> {
        const userIds = canonicalPair(userIdA, userIdB);
        await this.friendships().deleteOne({ userIds });
    }
}
