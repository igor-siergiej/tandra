import type { MongoDbConnection } from '@imapps/api-utils';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { DiscoveryPublication, DiscoveryPublicationRepository } from '../../domain/DiscoveryPublicationRepository';

const NO_OBJECT_ID = { projection: { _id: 0 } } as const;

export class MongoDiscoveryPublicationRepository implements DiscoveryPublicationRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.DiscoveryPublication);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ recipeId: 1 }, { unique: true });
        await this.collection().createIndex({ libraryId: 1 }, { unique: true });
        await this.collection().createIndex({ ownerId: 1 });
    }

    async getByRecipeId(recipeId: string): Promise<DiscoveryPublication | null> {
        return this.collection().findOne({ recipeId }, NO_OBJECT_ID);
    }

    async getByLibraryId(libraryId: string): Promise<DiscoveryPublication | null> {
        return this.collection().findOne({ libraryId }, NO_OBJECT_ID);
    }

    async listPublishedByOwner(ownerId: string): Promise<DiscoveryPublication[]> {
        return this.collection()
            .find({ ownerId, publishedAt: { $exists: true } }, NO_OBJECT_ID)
            .toArray();
    }

    async upsert(publication: DiscoveryPublication): Promise<void> {
        await this.collection().replaceOne({ recipeId: publication.recipeId }, publication, { upsert: true });
    }

    async deleteByLibraryId(libraryId: string): Promise<void> {
        await this.collection().deleteOne({ libraryId });
    }
}
