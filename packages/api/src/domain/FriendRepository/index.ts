import type { Friendship, PairingCode, User } from '@tandra/types';

export interface FriendRepository {
    ensureIndexes(): Promise<void>;
    // pairing codes
    insertCode(code: PairingCode): Promise<void>;
    getCode(code: string): Promise<PairingCode | null>;
    markCodeUsed(code: string, usedAt: Date): Promise<void>;

    // friendships
    insertFriendship(friendship: Friendship): Promise<void>;
    /** Current friends resolved from canonical account records, excluding deleted accounts. */
    findFriends(userId: string): Promise<User[]>;
    /** The single doc for a canonical pair, or null. */
    findPair(userIdA: string, userIdB: string): Promise<Friendship | null>;
    deletePair(userIdA: string, userIdB: string): Promise<void>;
    /** Deletes every friendship the user is part of, in both directions, and the pairing codes they created. Idempotent. */
    deleteAllForUser(userId: string): Promise<void>;
}
