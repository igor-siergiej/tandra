import type { Logger } from '@imapps/api-utils';
import type { ListInvite, ListInvitePreview, User } from '@tandra/types';

import type { FriendService } from '../FriendService';
import { DEFAULT_INVITE_TTL_MS, generateInviteToken } from '../inviteToken';
import type { ListInviteRepository } from '../ListInviteRepository';
import type { ListService } from '../ListService';

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

export interface IssuedInvite {
    token: string;
    listTitle: string;
    ownerId: string;
    createdAt: Date;
    expiresAt: Date;
}

/** Public view of a token used by the web /invite/:token page and the unauthenticated GET. */
export interface ListInvitePublic extends IssuedInvite {
    ownerUsername: string;
    isClosed: boolean;
    isClaimed: boolean;
    isRevoked: boolean;
    isExpired: boolean;
}

export interface ListInviteServiceServices {
    invites: ListInviteRepository;
    lists: Pick<ListService, 'getList' | 'addInvitedUser'>;
    friends: Pick<FriendService, 'createFriendship'>;
}

export class ListInviteService {
    private readonly logger?: Logger;

    constructor(
        private readonly services: ListInviteServiceServices,
        logger?: Logger
    ) {
        this.logger = logger;
    }

    /** Issue a fresh token for one of the caller's lists. TTL defaults to 7 days. */
    async issue(listTitle: string, owner: User, ttlMs: number = DEFAULT_INVITE_TTL_MS): Promise<IssuedInvite> {
        const list = await this.services.lists.getList(listTitle);
        if (!list) throw fail('List not found', 404);
        if (list.ownerId !== owner.id) throw fail('Only the list owner can invite', 403);
        const now = new Date();
        const invite: ListInvite = {
            token: generateInviteToken(),
            listTitle,
            ownerId: owner.id,
            ownerUsername: owner.username,
            createdAt: now,
            expiresAt: new Date(now.getTime() + ttlMs),
        };
        await this.services.invites.insert(invite);
        this.logger?.info('List invite issued', { listTitle, ownerId: owner.id, token: invite.token.slice(0, 8) });
        return {
            token: invite.token,
            listTitle: invite.listTitle,
            ownerId: invite.ownerId,
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
        };
    }

    /** Owner-only: revoke an outstanding invite. Idempotent. */
    async revoke(token: string, owner: User): Promise<void> {
        const invite = await this.services.invites.getByToken(token);
        if (!invite) throw fail('Invite not found', 404);
        if (invite.ownerId !== owner.id) throw fail('Only the inviter can revoke', 403);
        if (invite.revokedAt) return;
        await this.services.invites.markRevoked(token, new Date());
        this.logger?.info('List invite revoked', { token: token.slice(0, 8), by: owner.id });
    }

    /** Unauthenticated preview. Returns enough for the /invite/:token page to render without leaking owner metadata. */
    // fallow-ignore-next-line complexity
    async preview(token: string, viewerId?: string): Promise<ListInvitePreview> {
        const invite = await this.services.invites.getByToken(token);
        if (!invite) throw fail('Invite not found', 404);
        const ownerUsername = invite.ownerUsername;
        const expired = invite.expiresAt.getTime() < Date.now();
        const isClosed = Boolean(invite.revokedAt || invite.claimedAt || expired);
        return {
            listTitle: invite.listTitle,
            ownerUsername,
            expiresAt: invite.expiresAt,
            isClosed,
            isOwner: Boolean(viewerId && viewerId === invite.ownerId),
        };
    }

    /**
     * Claim an invite: add the claimer to the list and make the owner and
     * the claimer friends. Single-use (Mongo `findOneAndUpdate` on claimedAt
     * makes the second claimer a no-op rather than a duplicate-join).
     */
    // fallow-ignore-next-line complexity
    async claim(token: string, claimer: User): Promise<{ listTitle: string; ownerId: string }> {
        const invite = await this.services.invites.getByToken(token);
        if (!invite) throw fail('Invite not found', 404);
        if (invite.revokedAt) throw fail('This invite has been revoked', 410);
        if (invite.claimedAt) throw fail('This invite has already been used', 410);
        if (invite.expiresAt.getTime() < Date.now()) throw fail('This invite has expired', 410);
        if (invite.ownerId === claimer.id) throw fail('You cannot accept your own invite', 400);

        const claimed = await this.services.invites.markClaimed(token, claimer.id, new Date());
        if (!claimed) throw fail('This invite has already been used', 410);

        await this.services.friends.createFriendship({ id: invite.ownerId, username: invite.ownerUsername }, claimer);
        await this.services.lists.addInvitedUser(invite.listTitle, claimer, invite.ownerId);
        this.logger?.info('List invite claimed', {
            listTitle: invite.listTitle,
            ownerId: invite.ownerId,
            claimerId: claimer.id,
        });
        return { listTitle: invite.listTitle, ownerId: invite.ownerId };
    }

    /** All live invites the owner has issued, newest first. Used by the web "manage invites" UI. */
    async listOpenByOwner(ownerId: string): Promise<ListInvitePublic[]> {
        const now = new Date();
        const invites = await this.services.invites.listOpenByOwner(ownerId, now);
        return invites.map((invite) => ({
            token: invite.token,
            listTitle: invite.listTitle,
            ownerId: invite.ownerId,
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
            ownerUsername: invite.ownerUsername,
            isClosed: false,
            isClaimed: false,
            isRevoked: false,
            isExpired: false,
        }));
    }
}
