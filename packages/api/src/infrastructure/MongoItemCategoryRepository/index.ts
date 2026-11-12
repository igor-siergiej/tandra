import type { MongoDbConnection } from '@imapps/api-utils';
import type { ItemCategory } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { ItemCategoryRepository } from '../../domain/ItemCategoryRepository';

export interface ItemCategoryDoc {
    name: string;
    category: ItemCategory;
}

export class MongoItemCategoryRepository implements ItemCategoryRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.ItemCategory);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ name: 1 }, { unique: true });
    }

    async get(name: string): Promise<ItemCategory | null> {
        const doc = await this.collection().findOne({ name });

        return doc?.category ?? null;
    }

    async set(name: string, category: ItemCategory): Promise<void> {
        await this.collection().updateOne({ name }, { $setOnInsert: { name, category } }, { upsert: true });
    }
}
