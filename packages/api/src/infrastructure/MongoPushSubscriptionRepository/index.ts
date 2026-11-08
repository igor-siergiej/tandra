import type { MongoDbConnection } from '@imapps/api-utils';
import type { PushSubscription } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { PushSubscriptionRepository } from '../../domain/PushSubscriptionRepository';

export class MongoPushSubscriptionRepository implements PushSubscriptionRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.PushSubscription);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ endpoint: 1 });
        await this.collection().createIndex({ userId: 1 });
    }

    async upsert(sub: PushSubscription): Promise<void> {
        await this.collection().replaceOne({ endpoint: sub.endpoint }, sub, { upsert: true });
    }

    async deleteByEndpoint(endpoint: string, userId: string): Promise<void> {
        await this.collection().deleteOne({ endpoint, userId });
    }

    async findByUserIds(userIds: string[]): Promise<PushSubscription[]> {
        if (userIds.length === 0) {
            return [];
        }
        return this.collection()
            .find({ userId: { $in: userIds } })
            .toArray();
    }

    async deleteByEndpoints(endpoints: string[]): Promise<void> {
        if (endpoints.length === 0) {
            return;
        }
        await this.collection().deleteMany({ endpoint: { $in: endpoints } });
    }
}
