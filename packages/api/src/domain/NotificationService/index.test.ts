import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { Item, List, PushSubscription, Todo, User } from '@tandra/types';
import { ListType } from '@tandra/types';

import { acceptingPushSender } from '../../testing/doubles';
import { fake } from '../../testing/fake';
import { formatAddedBody, NotificationService } from './index';

/** Let the debounce timer (constructed with debounceMs=0) fire, then drain its async flush. */
const tick = () => new Promise((r) => setTimeout(r, 5));

const owner: User = { id: 'u1', username: 'owner' };
const member: User = { id: 'u2', username: 'member' };

const list: List = {
    id: 'l1',
    title: 'Groceries',
    dateAdded: new Date(),
    items: [],
    users: [owner, member],
    listType: ListType.SHOPPING,
    ownerId: 'u1',
};

const item = (name: string): Item => ({ id: name, name, isSelected: false, dateAdded: new Date() });

const subFor = (userId: string, endpoint: string): PushSubscription => ({
    endpoint,
    userId,
    keys: { p256dh: 'p', auth: 'a' },
    dateAdded: new Date(),
});

const makeRepo = (subs: PushSubscription[]) => ({
    findByUserIds: mock(async (ids: string[]) => subs.filter((s) => ids.includes(s.userId))),
    deleteByEndpoints: mock(async () => {}),
    upsert: mock(async () => {}),
    deleteByEndpoint: mock(async () => {}),
});

describe('formatAddedBody', () => {
    it('lists a single item', () => {
        expect(formatAddedBody('owner', ['Milk'])).toBe('owner added Milk');
    });

    it('lists up to three items in full', () => {
        expect(formatAddedBody('owner', ['Milk', 'Eggs', 'Bread'])).toBe('owner added Milk, Eggs, Bread');
    });

    it('collapses the tail into "and N more"', () => {
        expect(formatAddedBody('owner', ['Milk', 'Eggs', 'Bread', 'Butter', 'Jam'])).toBe(
            'owner added Milk, Eggs, Bread and 2 more'
        );
    });
});

describe('NotificationService coalescing', () => {
    let repo: ReturnType<typeof makeRepo>;
    let sender = acceptingPushSender();

    beforeEach(() => {
        repo = makeRepo([subFor('u2', 'e2')]);
        sender = acceptingPushSender();
    });

    it('coalesces rapid single adds into ONE notification', async () => {
        const service = new NotificationService(fake(repo), fake(sender), undefined, 0);
        await service.notifyItemAdded(list, item('Milk'), owner);
        await service.notifyItemAdded(list, item('Eggs'), owner);
        await service.notifyItemAdded(list, item('Bread'), owner);
        await service.notifyItemAdded(list, item('Butter'), owner);
        await tick();

        expect(sender.send).toHaveBeenCalledTimes(1);
        const [, payload] = sender.send.mock.calls[0];
        expect(JSON.parse(payload)).toEqual({
            title: 'Groceries',
            body: 'owner added Milk, Eggs, Bread and 1 more',
            data: { url: '/list/l1' },
        });
    });

    it('sends only to members other than the actor, and prunes "gone" subs', async () => {
        sender.send = mock(async () => 'gone' as const);
        const service = new NotificationService(fake(repo), fake(sender), undefined, 0);
        await service.notifyItemAdded(list, item('Milk'), owner);
        await tick();

        expect(repo.findByUserIds).toHaveBeenCalledWith(['u2']);
        expect(repo.deleteByEndpoints).toHaveBeenCalledWith(['e2']);
    });

    it('does nothing when the only member is the actor', async () => {
        const service = new NotificationService(fake(repo), fake(sender), undefined, 0);
        await service.notifyItemAdded({ ...list, users: [owner] }, item('Milk'), owner);
        await tick();

        expect(repo.findByUserIds).not.toHaveBeenCalled();
        expect(sender.send).not.toHaveBeenCalled();
    });

    it('never throws when the sender rejects', async () => {
        sender.send = mock(async () => {
            throw new Error('boom');
        });
        const service = new NotificationService(fake(repo), fake(sender), undefined, 0);
        await service.notifyItemAdded(list, item('Milk'), owner);
        await expect(tick()).resolves.toBeUndefined();
    });

    it('skips entirely when the sender is unconfigured', async () => {
        sender.isConfigured = () => false;
        const service = new NotificationService(fake(repo), fake(sender), undefined, 0);
        await service.notifyItemAdded(list, item('Milk'), owner);
        await tick();

        expect(repo.findByUserIds).not.toHaveBeenCalled();
    });

    it('formats a bulk add from its item names', async () => {
        const service = new NotificationService(fake(repo), fake(sender), undefined, 0);
        await service.notifyItemsAdded(list, ['A', 'B', 'C', 'D'], owner);
        await tick();

        expect(JSON.parse(sender.send.mock.calls[0][1]).body).toBe('owner added A, B, C and 1 more');
    });
});

describe('NotificationService.notifyTodoShared', () => {
    let repo: ReturnType<typeof makeRepo>;
    let sender = acceptingPushSender();

    const todo = (over: Partial<Todo>): Todo => ({
        id: 't1',
        ownerId: 'u1',
        title: 'Pay rent',
        done: false,
        dateAdded: new Date(),
        ...over,
    });

    beforeEach(() => {
        repo = makeRepo([subFor('u2', 'e2')]);
        sender = acceptingPushSender();
    });

    it('pushes an immediate notification to shared members, excluding the actor', async () => {
        const service = new NotificationService(fake(repo), fake(sender));
        await service.notifyTodoShared(todo({ users: [owner, member] }), owner);

        expect(repo.findByUserIds).toHaveBeenCalledWith(['u2']);
        expect(sender.send).toHaveBeenCalledTimes(1);
        const [, payload] = sender.send.mock.calls[0];
        expect(JSON.parse(payload)).toEqual({
            title: 'Shared todo',
            body: 'owner shared a todo: Pay rent',
            data: { url: '/calendar' },
        });
    });

    it('does nothing when there are no shared members', async () => {
        const service = new NotificationService(fake(repo), fake(sender));
        await service.notifyTodoShared(todo({}), owner);

        expect(repo.findByUserIds).not.toHaveBeenCalled();
        expect(sender.send).not.toHaveBeenCalled();
    });

    it('skips entirely when the sender is unconfigured', async () => {
        sender.isConfigured = () => false;
        const service = new NotificationService(fake(repo), fake(sender));
        await service.notifyTodoShared(todo({ users: [owner, member] }), owner);

        expect(repo.findByUserIds).not.toHaveBeenCalled();
    });

    it('never throws when the sender rejects', async () => {
        sender.send = mock(async () => {
            throw new Error('boom');
        });
        const service = new NotificationService(fake(repo), fake(sender));
        await expect(service.notifyTodoShared(todo({ users: [owner, member] }), owner)).resolves.toBeUndefined();
    });
});
