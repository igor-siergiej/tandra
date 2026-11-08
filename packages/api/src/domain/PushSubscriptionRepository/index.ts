import type { PushSubscription } from '@tandra/types';

export interface PushSubscriptionRepository {
    ensureIndexes(): Promise<void>;
    /** Insert or replace a subscription, keyed by its endpoint. */
    upsert(sub: PushSubscription): Promise<void>;
    /** Remove one of the user's own subscriptions; another user's row for the same endpoint is left alone. */
    deleteByEndpoint(endpoint: string, userId: string): Promise<void>;
    findByUserIds(userIds: string[]): Promise<PushSubscription[]>;
    /** Bulk-remove expired/invalid subscriptions discovered during send. */
    deleteByEndpoints(endpoints: string[]): Promise<void>;
}
