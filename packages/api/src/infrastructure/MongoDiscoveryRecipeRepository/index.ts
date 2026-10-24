import type { MongoDbConnection } from '@imapps/api-utils';
import type { DiscoveryRecipe, DiscoverySource } from '@tandra/types';
import { ObjectId } from 'mongodb';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { DiscoveryRecipeRepository, WikibooksSlugBackfill } from '../../domain/DiscoveryRecipeRepository';
import { WIKIBOOKS_RECIPE_ID } from '../../domain/WikibooksIngest/mapping';

// `_id` is Mongo bookkeeping, not part of the library contract.
const NO_OBJECT_ID = { projection: { _id: 0 } } as const;

// `listPublic` returns `_id` so cursors can be issued from it; callers that
// hand the result straight to a public response strip it out via PUBLIC_PROJECTION.
const WITH_OBJECT_ID = { projection: {} } as const;

export class MongoDiscoveryRecipeRepository implements DiscoveryRecipeRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.DiscoveryRecipe);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ id: 1 }, { unique: true });
        await this.collection().createIndex({ coverImageKey: 1 }, { sparse: true });
        // Sparse because a slug is optional (a publish that cannot allocate one goes out without). Must exist before
        // `assignWikibooksSlugs` runs, so a clash fails that update instead of storing a duplicate.
        await this.collection().createIndex({ slug: 1 }, { unique: true, sparse: true });
    }

    async assignWikibooksSlugs(): Promise<WikibooksSlugBackfill> {
        // Publishing reserves the `wikibooks-<n>` shape now, but a recipe published before that could own one. Its
        // Wikibooks twin is left out instead of failing the whole update on the unique index.
        const claimed = await this.collection().distinct('slug', {
            source: { $ne: 'wikibooks' },
            slug: { $regex: WIKIBOOKS_RECIPE_ID },
        });
        const slugless = { source: 'wikibooks' as const, slug: { $exists: false } };
        const { modifiedCount } = await this.collection().updateMany({ ...slugless, id: { $nin: claimed } }, [
            { $set: { slug: '$id' } },
        ]);
        const blocked =
            claimed.length === 0 ? [] : await this.collection().distinct('id', { ...slugless, id: { $in: claimed } });
        return { assigned: modifiedCount, blocked };
    }

    async getById(id: string): Promise<DiscoveryRecipe | null> {
        return this.collection().findOne({ id }, NO_OBJECT_ID);
    }

    async getBySlug(slug: string): Promise<DiscoveryRecipe | null> {
        return this.collection().findOne({ slug }, NO_OBJECT_ID);
    }

    async hasSlug(slug: string): Promise<boolean> {
        return (await this.collection().countDocuments({ slug }, { limit: 1 })) > 0;
    }

    async getByIds(ids: string[]): Promise<DiscoveryRecipe[]> {
        if (ids.length === 0) return [];
        return this.collection()
            .find({ id: { $in: ids } }, NO_OBJECT_ID)
            .toArray();
    }

    async upsert(recipe: DiscoveryRecipe): Promise<void> {
        await this.collection().replaceOne({ id: recipe.id }, recipe, { upsert: true });
    }

    async deleteById(id: string): Promise<void> {
        await this.collection().deleteOne({ id });
    }

    async listPublic(pageSize: number, after: string | null): Promise<DiscoveryRecipe[]> {
        // Stable order: createdAt DESC, _id DESC. The cursor is the _id of the
        // last item on the previous page; "_id < after" gives a clean seek.
        const filter = after
            ? { slug: { $exists: true }, _id: { $lt: new ObjectId(after) } }
            : { slug: { $exists: true } };
        return this.collection()
            .find(filter, WITH_OBJECT_ID)
            .sort({ createdAt: -1, _id: -1 })
            .limit(pageSize)
            .toArray() as Promise<DiscoveryRecipe[]>;
    }

    async findByTitle(title: string): Promise<DiscoveryRecipe[]> {
        // Case-insensitive equality (collation strength 2); the library is a few thousand documents, so no title index.
        return this.collection()
            .find({ title }, { ...NO_OBJECT_ID, collation: { locale: 'en', strength: 2 } })
            .toArray() as Promise<DiscoveryRecipe[]>;
    }

    async hasCoverImageKey(key: string): Promise<boolean> {
        return (await this.collection().countDocuments({ coverImageKey: key }, { limit: 1 })) > 0;
    }

    async listRevisions(
        source: DiscoverySource
    ): Promise<Array<Pick<DiscoveryRecipe, 'id' | 'sourceRevision' | 'imageRevision' | 'createdAt'>>> {
        return this.collection()
            .find({ source }, { projection: { _id: 0, id: 1, sourceRevision: 1, imageRevision: 1, createdAt: 1 } })
            .toArray() as Promise<
            Array<Pick<DiscoveryRecipe, 'id' | 'sourceRevision' | 'imageRevision' | 'createdAt'>>
        >;
    }

    async *batches(size: number): AsyncGenerator<DiscoveryRecipe[]> {
        const cursor = this.collection().find({}, NO_OBJECT_ID).sort({ id: 1 });
        let batch: DiscoveryRecipe[] = [];
        for await (const recipe of cursor) {
            batch.push(recipe as DiscoveryRecipe);
            if (batch.length >= size) {
                yield batch;
                batch = [];
            }
        }
        if (batch.length > 0) yield batch;
    }
}
