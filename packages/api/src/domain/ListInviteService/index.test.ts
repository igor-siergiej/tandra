import { describe, expect, it } from 'bun:test';

import type { ListInvite } from '@tandra/types';

import type { FriendService } from '../FriendService';
import type { ListInviteRepository } from '../ListInviteRepository';
import type { ListService } from '../ListService';
import { type IssuedInvite, type ListInvitePublic, ListInviteService } from './index';

const noopLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
};

const FAKE_USER_A = { id: 'user-a', username: 'alice' };
const FAKE_USER_B = { id: 'user-b', username: 'bob' };

const fakeInvite = (over: Partial<ListInvite> = {}): ListInvite => ({
    token: 'token-abc',
    listTitle: 'Groceries',
    ownerId: 'user-a',
    ownerUsername: 'alice',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...over,
});

const setup = (initialInvites: ListInvite[] = []) => {
    const invites: ListInvite[] = [...initialInvites];

    const invitesRepo: ListInviteRepository = {
        ensureIndexes: async () => {},
        insert: async (invite) => {
            invites.push(invite);
        },
        getByToken: async (token) => invites.find((i) => i.token === token) ?? null,
        markClaimed: async (token, userId, at) => {
            const existing = invites.find((i) => i.token === token);

            if (!existing || existing.claimedAt) return null;
            existing.claimedBy = userId;
            existing.claimedAt = at;

            return existing;
        },
        markRevoked: async (token, at) => {
            const existing = invites.find((i) => i.token === token);

            if (existing && !existing.revokedAt) existing.revokedAt = at;
        },
        listOpenByOwner: async (ownerId) =>
            invites
                .filter(
                    (i) => i.ownerId === ownerId && !i.revokedAt && !i.claimedAt && i.expiresAt.getTime() > Date.now()
                )
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };

    const list = {
        id: 'l1',
        title: 'Groceries',
        ownerId: 'user-a',
        users: [{ id: 'user-a', username: 'alice' }],
    } as never;

    const lists: Pick<ListService, 'getList' | 'addInvitedUser'> = {
        getList: async () => list,
        addInvitedUser: async (_title, claimer, _ownerId) => {
            (list as { users: unknown[] }).users.push(claimer);

            return list;
        },
    };

    const friends: Pick<FriendService, 'createFriendship'> = {
        createFriendship: async () => ({}) as never,
    };

    const service = new ListInviteService({ invites: invitesRepo, lists, friends }, noopLogger);

    return { service, invites, invitesRepo, list, lists, friends };
};

describe('ListInviteService.issue', () => {
    it('rejects callers who are not the list owner with 403', async () => {
        const { service } = setup();
        await expect(service.issue('Groceries', FAKE_USER_B)).rejects.toMatchObject({ status: 403 });
    });

    it('returns a 404 when the list does not exist', async () => {
        const { service, lists } = setup();
        lists.getList = async () => null;
        await expect(service.issue('Missing', FAKE_USER_A)).rejects.toMatchObject({ status: 404 });
    });

    it('persists a new invite with a unique random token and a future expiry', async () => {
        const { service, invites } = setup();
        const before = Date.now();
        const invite: IssuedInvite = await service.issue('Groceries', FAKE_USER_A);
        expect(invites).toHaveLength(1);
        expect(invites[0]?.ownerId).toBe('user-a');
        expect(invites[0]?.ownerUsername).toBe('alice');
        expect(invites[0]?.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
        expect(invite.token).toBe(invites[0]?.token);
        expect(invites[0]?.expiresAt.getTime()).toBeGreaterThan(before);
    });
});

describe('ListInviteService.preview', () => {
    it('returns 404 for an unknown token', async () => {
        const { service } = setup();
        await expect(service.preview('missing')).rejects.toMatchObject({ status: 404 });
    });

    it('marks the preview closed when the token is revoked, claimed, or expired', async () => {
        const pastInvite = fakeInvite({ token: 't1', expiresAt: new Date(Date.now() - 1000) });
        const claimedInvite = fakeInvite({ token: 't2', claimedBy: 'someone', claimedAt: new Date() });
        const revokedInvite = fakeInvite({ token: 't3', revokedAt: new Date() });
        const { service } = setup([pastInvite, claimedInvite, revokedInvite]);
        expect((await service.preview('t1')).isClosed).toBe(true);
        expect((await service.preview('t2')).isClosed).toBe(true);
        expect((await service.preview('t3')).isClosed).toBe(true);
    });

    it('marks the preview open and flags ownership when the viewer is the owner', async () => {
        const { service } = setup([fakeInvite({ token: 't1' })]);
        const preview = await service.preview('t1', 'user-a');
        expect(preview.isClosed).toBe(false);
        expect(preview.isOwner).toBe(true);
    });
});

describe('ListInviteService.revoke', () => {
    it('refuses to revoke a token that belongs to a different user', async () => {
        const { service } = setup([fakeInvite()]);
        await expect(service.revoke('token-abc', FAKE_USER_B)).rejects.toMatchObject({ status: 403 });
    });

    it('sets revokedAt on a matching invite', async () => {
        const { service, invites } = setup([fakeInvite()]);
        await service.revoke('token-abc', FAKE_USER_A);
        expect(invites[0]?.revokedAt).toBeInstanceOf(Date);
    });

    it('is idempotent on a second revoke', async () => {
        const { service, invites } = setup([fakeInvite()]);
        await service.revoke('token-abc', FAKE_USER_A);
        const firstRevoke = invites[0]?.revokedAt;
        await service.revoke('token-abc', FAKE_USER_A);
        expect(invites[0]?.revokedAt).toBe(firstRevoke);
    });
});

describe('ListInviteService.claim', () => {
    it('rejects a self-claim', async () => {
        const { service } = setup([fakeInvite()]);
        await expect(service.claim('token-abc', FAKE_USER_A)).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an already-claimed token with 410', async () => {
        const { service } = setup([fakeInvite({ claimedBy: 'someone', claimedAt: new Date() })]);
        await expect(service.claim('token-abc', FAKE_USER_B)).rejects.toMatchObject({ status: 410 });
    });

    it('rejects a revoked token with 410', async () => {
        const { service } = setup([fakeInvite({ revokedAt: new Date() })]);
        await expect(service.claim('token-abc', FAKE_USER_B)).rejects.toMatchObject({ status: 410 });
    });

    it('rejects an expired token with 410', async () => {
        const { service } = setup([fakeInvite({ expiresAt: new Date(Date.now() - 1000) })]);
        await expect(service.claim('token-abc', FAKE_USER_B)).rejects.toMatchObject({ status: 410 });
    });

    it('claims successfully: marks the invite, creates the friendship, adds to list', async () => {
        const { service, invites, friends, list } = setup([fakeInvite()]);
        let created = { a: '', b: '' };
        friends.createFriendship = async (a, b) => {
            created = { a: a.id, b: b.id };

            return {} as never;
        };

        const result = await service.claim('token-abc', FAKE_USER_B);
        expect(result.listTitle).toBe('Groceries');
        expect(invites[0]?.claimedBy).toBe('user-b');
        expect(invites[0]?.claimedAt).toBeInstanceOf(Date);
        expect(created).toEqual({ a: 'user-a', b: 'user-b' });
        expect(list.users.find((u) => u.id === 'user-b')).toBeDefined();
    });
});

describe('ListInviteService.listOpenByOwner', () => {
    it('returns only live invites for the owner, newest first', async () => {
        const older = fakeInvite({
            token: 'old',
            createdAt: new Date('2026-01-01'),
            expiresAt: new Date(Date.now() + 60_000),
        });

        const newer = fakeInvite({
            token: 'new',
            createdAt: new Date('2026-02-01'),
            expiresAt: new Date(Date.now() + 60_000),
        });

        const revoked = fakeInvite({
            token: 'rev',
            createdAt: new Date('2026-01-15'),
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: new Date(),
        });

        const { service } = setup([older, newer, revoked]);
        const items: ListInvitePublic[] = await service.listOpenByOwner('user-a');
        expect(items.map((i) => i.token)).toEqual(['new', 'old']);
    });
});
