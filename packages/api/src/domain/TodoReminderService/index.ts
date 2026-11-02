import type { Logger } from '@imapps/api-utils';
import type { PushSubscription, Todo } from '@tandra/types';
import { isoDay, occursOn } from '@tandra/types';

import { caughtErrorSchema } from '../../infrastructure/caughtError';
import type { WebPushSender } from '../../infrastructure/WebPushSender';
import type { PushSubscriptionRepository } from '../PushSubscriptionRepository';
import type { TodoRepository } from '../TodoRepository';

/** Max todo titles listed before the rest collapse into "and N more". */
const MAX_TITLES_SHOWN = 3;

// fallow-ignore-next-line unused-export
export const formatDueBody = (titles: string[]): string => {
    const shown = titles.slice(0, MAX_TITLES_SHOWN).join(', ');
    const extra = titles.length - MAX_TITLES_SHOWN;

    return extra > 0 ? `${shown} and ${extra} more` : shown;
};

/** Owner plus every shared member — each gets their own summary push for a due todo. */
const recipientsOf = (todo: Todo): string[] => [todo.ownerId, ...(todo.users ?? []).map((u) => u.id)];

const groupByRecipient = (todos: Todo[]): Map<string, Todo[]> => {
    const byRecipient = new Map<string, Todo[]>();

    for (const todo of todos) {
        for (const recipientId of recipientsOf(todo)) {
            const list = byRecipient.get(recipientId) ?? [];
            list.push(todo);
            byRecipient.set(recipientId, list);
        }
    }

    return byRecipient;
};

const emptySummary = (configured: boolean): ReminderSummary => ({
    configured,
    due: 0,
    recipients: 0,
    subscriptions: 0,
    sent: 0,
});

/** Outcome of a reminder run — surfaced to the manual trigger for debugging. */
export interface ReminderSummary {
    /** Web push has VAPID keys; false means nothing can ever be sent. */
    configured: boolean;
    /** Incomplete todos occurring today. */
    due: number;
    /** Distinct recipients (owner + shared members) with at least one due todo. */
    recipients: number;
    /** Push subscriptions targeted across those recipients. */
    subscriptions: number;
    /** Pushes the browser push service accepted. */
    sent: number;
}

/**
 * Sends one summary push per recipient (owner + shared members) for todos due "today".
 *
 * Single-replica, like NotificationService: invoked by the in-process DailyReminderScheduler.
 */
export class TodoReminderService {
    constructor(
        private readonly todoRepo: TodoRepository,
        private readonly pushRepo: PushSubscriptionRepository,
        private readonly sender: WebPushSender,
        private readonly logger?: Logger
    ) {}

    async sendDailyReminders(now: Date): Promise<ReminderSummary> {
        const configured = this.sender.isConfigured();

        if (!configured) {
            return emptySummary(configured);
        }

        const candidates = await this.todoRepo.findDueCandidates(isoDay(now));
        const due = candidates.filter((todo) => occursOn(todo, now));

        if (due.length === 0) {
            return emptySummary(configured);
        }

        const byRecipient = groupByRecipient(due);

        const perRecipient = await Promise.all(
            [...byRecipient.entries()].map(([recipientId, todos]) => this.notifyRecipient(recipientId, todos))
        );

        return {
            configured,
            due: due.length,
            recipients: byRecipient.size,
            subscriptions: perRecipient.reduce((n, r) => n + r.subscriptions, 0),
            sent: perRecipient.reduce((n, r) => n + r.sent, 0),
        };
    }

    private async notifyRecipient(
        recipientId: string,
        todos: Todo[]
    ): Promise<{ subscriptions: number; sent: number }> {
        try {
            const subs = await this.pushRepo.findByUserIds([recipientId]);

            if (subs.length === 0) {
                return { subscriptions: 0, sent: 0 };
            }

            const payload = JSON.stringify({
                title: 'Todos due today',
                body: formatDueBody(todos.map((t) => t.title)),
                data: { url: '/calendar' },
            });

            const results = await Promise.all(subs.map((sub: PushSubscription) => this.sender.send(sub, payload)));
            const dead = subs.filter((_, i) => results[i] === 'gone').map((s) => s.endpoint);

            if (dead.length > 0) {
                await this.pushRepo.deleteByEndpoints(dead);
            }

            return { subscriptions: subs.length, sent: results.filter((r) => r === 'ok').length };
        } catch (error) {
            this.logger?.error('Todo reminder fan-out failed', {
                recipientId,
                error: caughtErrorSchema.parse(error).message,
            });

            return { subscriptions: 0, sent: 0 };
        }
    }
}
