import { beforeEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { ListInvite } from '@tandra/types';

import type { FriendService } from '../FriendService';
import type { ListInviteRepository } from '../ListInviteRepository';
import type { ListService } from '../ListService';
import { ListInviteService } from './index';

// The privacy notice promises logs hold no list-item text: the title of the list being shared must not be logged.
const LIST_TITLE = 'quokkafest-list-title';

const owner = { id: 'user-a', username: 'alice' };
const claimer = { id: 'user-b', username: 'bob' };

const calls: Array<unknown[]> = [];

const logger = {
    info: (...args: unknown[]) => calls.push(args),
    warn: (...args: unknown[]) => calls.push(args),
    error: (...args: unknown[]) => calls.push(args),
    debug: (...args: unknown[]) => calls.push(args),
} as unknown as Logger;

describe('ListInviteService logging', () => {
    let invites: ListInvite[];
    let service: ListInviteService;

    beforeEach(() => {
        calls.length = 0;
        invites = [];

        const repo = {
            ensureIndexes: async () => {},
            insert: async (invite: ListInvite) => {
                invites.push(invite);
            },
            getByToken: async (token: string) => invites.find((i) => i.token === token) ?? null,
            markClaimed: async (token: string, userId: string, at: Date) => {
                const found = invites.find((i) => i.token === token);

                if (!found) return null;
                found.claimedBy = userId;
                found.claimedAt = at;

                return found;
            },
            markRevoked: async () => {},
            listOpenByOwner: async (): Promise<ListInvite[]> => [],
        } as unknown as ListInviteRepository;

        const list = {
            id: 'list-1',
            title: LIST_TITLE,
            ownerId: owner.id,
            users: [owner],
            items: [] as unknown[],
        };

        service = new ListInviteService(
            {
                invites: repo,
                lists: { getList: async () => list, addInvitedUser: async () => list } as unknown as Pick<
                    ListService,
                    'getList' | 'addInvitedUser'
                >,
                friends: { createFriendship: async (): Promise<void> => undefined } as unknown as Pick<
                    FriendService,
                    'createFriendship'
                >,
            },
            logger
        );
    });

    it('should log no list title when an invite is issued', async () => {
        await service.issue(LIST_TITLE, owner);

        expect(calls.length).toBeGreaterThan(0);
        expect(JSON.stringify(calls).toLowerCase()).not.toContain(LIST_TITLE);
    });

    it('should log no list title when an invite is claimed', async () => {
        const issued = await service.issue(LIST_TITLE, owner);
        calls.length = 0;

        await service.claim(issued.token, claimer);

        expect(calls.length).toBeGreaterThan(0);
        expect(JSON.stringify(calls).toLowerCase()).not.toContain(LIST_TITLE);
    });
});
