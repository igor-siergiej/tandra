import type { MongoDbConnection } from '@imapps/api-utils';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { DiscoveryReport, DiscoveryReportRepository } from '../../domain/DiscoveryReportRepository';

const NO_OBJECT_ID = { projection: { _id: 0 } } as const;

export class MongoDiscoveryReportRepository implements DiscoveryReportRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.DiscoveryReport);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ recipeId: 1, reporterId: 1 }, { unique: true });
    }

    async upsert(report: DiscoveryReport): Promise<void> {
        await this.collection().replaceOne({ recipeId: report.recipeId, reporterId: report.reporterId }, report, {
            upsert: true,
        });
    }

    async listAll(): Promise<DiscoveryReport[]> {
        return this.collection().find({}, NO_OBJECT_ID).sort({ createdAt: -1 }).toArray();
    }

    async deleteByRecipeId(recipeId: string): Promise<void> {
        await this.collection().deleteMany({ recipeId });
    }
}
