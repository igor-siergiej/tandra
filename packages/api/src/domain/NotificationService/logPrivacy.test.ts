import { describe, expect, it, mock } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { List, PushSubscription, Todo, User } from '@tandra/types';
import { ListType } from '@tandra/types';

import { NotificationService } from './index';

// The privacy notice promises logs hold no list or todo text: a failed push fan-out must log ids instead.
const LIST_TITLE = 'Dragonfruit List Title';
const TODO_TITLE = 'Dragonfruit Todo Title';
const ITEM_NAME = 'Dragonfruit Item Name';

const owner: User = { id: 'u1', username: 'owner' };
const member: User = { id: 'u2', username: 'member' };

const list: List = {
    id: 'l1',
    title: LIST_TITLE,
    dateAdded: new Date(),
    items: [],
    users: [owner, member],
    listType: ListType.SHOPPING,
    ownerId: 'u1',
};

const todo = { id: 't1', title: TODO_TITLE, users: [owner, member] } as unknown as Todo;

const sub: PushSubscription = {
    endpoint: 'e2',
    userId: 'u2',
    keys: { p256dh: 'p', auth: 'a' },
    dateAdded: new Date(),
};

const setup = () => {
    const logger = { info: mock(), warn: mock(), error: mock(), debug: mock() };

    const repo = {
        findByUserIds: mock(async () => [sub]),
        deleteByEndpoints: mock(async () => {}),
    };

    const sender = {
        send: mock(async () => {
            throw new Error('push service down');
        }),
        isConfigured: () => true,
    };

    const service = new NotificationService(repo as never, sender as never, logger as unknown as Logger, 0);

    return { logger, service };
};

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('NotificationService logging', () => {
    it('should log the list id, not the list title or item name, when a list fan-out fails', async () => {
        const { logger, service } = setup();

        await service.notifyItemsAdded(list, [ITEM_NAME], owner);
        await tick();

        expect(logger.error).toHaveBeenCalledTimes(1);
        const logged = JSON.stringify(logger.error.mock.calls).toLowerCase();
        expect(logged).not.toContain('dragonfruit');
        expect(logger.error.mock.calls[0][1]).toMatchObject({ listId: 'l1' });
    });

    it('should log the todo id, not the todo title, when a todo fan-out fails', async () => {
        const { logger, service } = setup();

        await service.notifyTodoShared(todo, owner);

        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(logger.error.mock.calls).toLowerCase()).not.toContain('dragonfruit');
        expect(logger.error.mock.calls[0][1]).toMatchObject({ todoId: 't1' });
    });
});
