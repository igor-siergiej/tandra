import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { PushSubscription, Todo } from '@tandra/types';

import { formatDueBody, TodoReminderService } from './index';

const NOW = new Date('2026-06-25T07:30:00.000Z'); // 08:30 BST

const todo = (over: Partial<Todo>): Todo => ({
    id: 'id',
    ownerId: 'u1',
    title: 'Task',
    done: false,
    dateAdded: new Date('2026-06-01'),
    dueDate: '2026-06-25',
    ...over,
});

const subFor = (userId: string, endpoint: string): PushSubscription => ({
    endpoint,
    userId,
    keys: { p256dh: 'p', auth: 'a' },
    dateAdded: new Date(),
});

const makePushRepo = (subs: PushSubscription[]) => ({
    findByUserIds: mock(async (ids: string[]) => subs.filter((s) => ids.includes(s.userId))),
    deleteByEndpoints: mock(async () => {}),
    upsert: mock(async () => {}),
    deleteByEndpoint: mock(async () => {}),
});

describe('formatDueBody', () => {
    it('lists a single todo', () => {
        expect(formatDueBody(['Pay rent'])).toBe('Pay rent');
    });
    it('lists up to three in full', () => {
        expect(formatDueBody(['Pay rent', 'Call dentist', 'Walk dog'])).toBe('Pay rent, Call dentist, Walk dog');
    });
    it('collapses the tail into "and N more"', () => {
        expect(formatDueBody(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more');
    });
});

describe('TodoReminderService.sendDailyReminders', () => {
    let pushRepo: ReturnType<typeof makePushRepo>;
    let sender: { send: ReturnType<typeof mock>; isConfigured: () => boolean };

    beforeEach(() => {
        pushRepo = makePushRepo([subFor('u1', 'e1')]);
        sender = { send: mock(async () => 'ok' as const), isConfigured: () => true };
    });

    const service = (todos: Todo[]) =>
        new TodoReminderService(
            { findDueCandidates: mock(async () => todos) } as never,
            pushRepo as never,
            sender as never
        );

    it('sends ONE summary push per owner with all their due todos', async () => {
        const summary = await service([
            todo({ id: 'a', title: 'Pay rent' }),
            todo({ id: 'b', title: 'Call dentist' }),
        ]).sendDailyReminders(NOW);

        expect(sender.send).toHaveBeenCalledTimes(1);
        const [, payload] = sender.send.mock.calls[0];
        expect(JSON.parse(payload as string)).toEqual({
            title: 'Todos due today',
            body: 'Pay rent, Call dentist',
            data: { url: '/calendar' },
        });
        expect(summary).toEqual({ configured: true, due: 2, recipients: 1, subscriptions: 1, sent: 1 });
    });

    it('reports configured:false without touching the repo', async () => {
        sender.isConfigured = () => false;
        const summary = await service([todo({})]).sendDailyReminders(NOW);
        expect(summary).toEqual({ configured: false, due: 0, recipients: 0, subscriptions: 0, sent: 0 });
    });

    it('groups by owner — one push each', async () => {
        pushRepo = makePushRepo([subFor('u1', 'e1'), subFor('u2', 'e2')]);
        await new TodoReminderService(
            { findDueCandidates: mock(async () => [todo({ ownerId: 'u1' }), todo({ ownerId: 'u2' })]) } as never,
            pushRepo as never,
            sender as never
        ).sendDailyReminders(NOW);

        expect(sender.send).toHaveBeenCalledTimes(2);
    });

    it('excludes todos not landing today (filtered by occursOn)', async () => {
        await service([
            todo({ dueDate: '2026-06-24' }), // yesterday, non-recurring
            todo({ done: true }), // done
            todo({ recurrence: { freq: 'daily', interval: 1 }, completedDates: ['2026-06-25'] }), // already ticked
        ]).sendDailyReminders(NOW);

        expect(sender.send).not.toHaveBeenCalled();
    });

    it('includes a recurring todo whose rule lands today', async () => {
        await service([todo({ dueDate: '2026-06-01', recurrence: { freq: 'daily', interval: 1 } })]).sendDailyReminders(
            NOW
        );

        expect(sender.send).toHaveBeenCalledTimes(1);
    });

    it('prunes "gone" subscriptions', async () => {
        sender.send = mock(async () => 'gone' as const);
        await service([todo({})]).sendDailyReminders(NOW);
        expect(pushRepo.deleteByEndpoints).toHaveBeenCalledWith(['e1']);
    });

    it('notifies both the owner and shared members, for a shared todo', async () => {
        pushRepo = makePushRepo([subFor('u1', 'e1'), subFor('u2', 'e2')]);
        await new TodoReminderService(
            {
                findDueCandidates: mock(async () => [
                    todo({ ownerId: 'u1', users: [{ id: 'u2', username: 'user-u2' }] }),
                ]),
            } as never,
            pushRepo as never,
            sender as never
        ).sendDailyReminders(NOW);

        expect(pushRepo.findByUserIds).toHaveBeenCalledWith(['u1']);
        expect(pushRepo.findByUserIds).toHaveBeenCalledWith(['u2']);
        expect(sender.send).toHaveBeenCalledTimes(2);
        expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), expect.any(String));
        expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }), expect.any(String));
    });

    it('skips owners with no subscriptions', async () => {
        pushRepo = makePushRepo([]);
        await new TodoReminderService(
            { findDueCandidates: mock(async () => [todo({})]) } as never,
            pushRepo as never,
            sender as never
        ).sendDailyReminders(NOW);
        expect(sender.send).not.toHaveBeenCalled();
    });

    it('does nothing when the sender is unconfigured', async () => {
        sender.isConfigured = () => false;
        const repo = { findDueCandidates: mock(async () => [todo({})]) };
        await new TodoReminderService(repo as never, pushRepo as never, sender as never).sendDailyReminders(NOW);
        expect(repo.findDueCandidates).not.toHaveBeenCalled();
        expect(sender.send).not.toHaveBeenCalled();
    });

    it('never throws when a send rejects, and reports zero sent', async () => {
        sender.send = mock(async () => {
            throw new Error('boom');
        });
        const summary = await service([todo({})]).sendDailyReminders(NOW);
        expect(summary).toEqual({ configured: true, due: 1, recipients: 1, subscriptions: 0, sent: 0 });
    });
});
