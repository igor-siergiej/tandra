import type { MongoDbConnection } from '@imapps/api-utils';
import type { Label } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { LabelRepository } from '../../domain/LabelRepository';

export class MongoLabelRepository implements LabelRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.Label);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ id: 1 });
        await this.collection().createIndex({ ownerId: 1 });
    }

    async getById(labelId: string): Promise<Label | null> {
        return this.collection().findOne({ id: labelId });
    }

    async findByOwnerId(ownerId: string): Promise<Label[]> {
        return this.collection().find({ ownerId }).toArray();
    }

    async insert(label: Label): Promise<Label> {
        await this.collection().insertOne(label);

        return label;
    }

    async update(labelId: string, label: Label): Promise<Label> {
        await this.collection().findOneAndReplace({ id: labelId }, label);
        const updated = await this.getById(labelId);

        if (!updated) {
            throw new Error('Label not found');
        }

        return updated;
    }

    async deleteById(labelId: string): Promise<void> {
        await this.collection().deleteOne({ id: labelId });
    }
}
