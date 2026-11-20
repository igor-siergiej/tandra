import type { PushSubscription } from '@tandra/types';

export interface PushSubscriptionRepository {
    ensureIndexes(): Promise<void>;
    /** Insert or replace a subscription, keyed by its endpoint. */
    upsert(sub: PushSubscription): Promise<void>;
    deleteByEndpoint(endpoint: string): Promise<void>;
    findByUserIds(userIds: string[]): Promise<PushSubscription[]>;
    /** Bulk-remove expired/invalid subscriptions discovered during send. */
    deleteByEndpoints(endpoints: string[]): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
}
