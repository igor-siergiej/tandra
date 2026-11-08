import type { MongoDbConnection } from '@imapps/api-utils';
import type { Item, ItemCategory, List } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { ListRepository } from '../../domain/ListRepository';

export class MongoListRepository implements ListRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.List);
    }

    // getByRef/replaceIfUnchanged/pushItem filter on id (or title) and findByUserId on users.id; without these every
    // request scans the whole collection (scripts/load/README.md: p95 225 ms -> 9 ms at 200 sessions/s).
    // Not unique: titles are not guaranteed unique in existing data, and a failed unique build would stop startup.
    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ id: 1 });
        await this.collection().createIndex({ title: 1 });
        await this.collection().createIndex({ 'users.id': 1 });
    }

    // Ids win; the title fallback keeps old links, push notifications and queued offline intents working. Titles may
    // repeat across users, so a title only ever resolves to the first match.
    async getByRef(ref: string): Promise<List | null> {
        return (await this.collection().findOne({ id: ref })) ?? this.collection().findOne({ title: ref });
    }

    async getAll(): Promise<Array<List>> {
        return this.collection().find({}).toArray();
    }

    async findByUserId(userId: string): Promise<Array<List>> {
        return this.collection().find({ 'users.id': userId }).toArray();
    }

    async insert(list: List): Promise<void> {
        await this.collection().insertOne(list);
    }

    async deleteById(listId: string): Promise<void> {
        await this.collection().deleteOne({ id: listId });
    }

    async replaceIfUnchanged(listId: string, list: List): Promise<number | null> {
        // Lists written before `revision` existed have no field; they match on its absence.
        const revision = list.revision === undefined ? { $exists: false } : list.revision;
        const next = (list.revision ?? 0) + 1;
        const result = await this.collection().replaceOne({ id: listId, revision }, { ...list, revision: next });

        return result.matchedCount === 1 ? next : null;
    }

    // Every writer that does not go through replaceIfUnchanged must bump `revision`, or a concurrent
    // read-modify-write would overwrite its change without noticing.
    async pushItem(listId: string, item: Item): Promise<void> {
        await this.collection().findOneAndUpdate({ id: listId }, { $push: { items: item }, $inc: { revision: 1 } });
    }

    async setCategoryIfUnset(listId: string, itemId: string, category: ItemCategory): Promise<boolean> {
        const result = await this.collection().updateOne(
            { id: listId },
            { $set: { 'items.$[item].category': category }, $inc: { revision: 1 } },
            { arrayFilters: [{ 'item.id': itemId, 'item.category': { $exists: false } }] }
        );

        return result.modifiedCount === 1;
    }

    async removeMemberFromAll(memberId: string, ownerId: string): Promise<void> {
        await this.collection().updateMany({ ownerId }, { $pull: { users: { id: memberId } }, $inc: { revision: 1 } });
    }
}
