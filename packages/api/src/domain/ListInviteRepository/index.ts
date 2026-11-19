import type { ListInvite } from '@tandra/types';

/** Persistence for /api/lists/invites. Mongo collection `listInvites`; the random token is the document id. */
export interface ListInviteRepository {
    ensureIndexes(): Promise<void>;
    insert(invite: ListInvite): Promise<void>;
    getByToken(token: string): Promise<ListInvite | null>;
    /** Marks the token as claimed by `userId` at `at`. Idempotent: returns the existing claim if already taken. */
    markClaimed(token: string, userId: string, at: Date): Promise<ListInvite | null>;
    /** Marks the token as revoked at `at`. Idempotent. */
    markRevoked(token: string, at: Date): Promise<void>;
    /** All open (non-revoked, non-claimed, not-yet-expired) invites a user has issued, newest first. */
    listOpenByOwner(ownerId: string, now: Date): Promise<ListInvite[]>;
    /** Deletes the invites a user issued and forgets that they claimed anyone else's. Idempotent. */
    eraseUser(userId: string): Promise<void>;
}
