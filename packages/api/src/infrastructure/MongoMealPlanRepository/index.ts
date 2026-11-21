import type { MongoDbConnection } from '@imapps/api-utils';
import type { MealPlanEntry } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { MealPlanRepository } from '../../domain/MealPlanRepository';

export class MongoMealPlanRepository implements MealPlanRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.MealPlan);
    }

    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ id: 1 }, { unique: true });
        await this.collection().createIndex({ ownerId: 1, date: 1 });
        await this.collection().createIndex({ 'users.id': 1, date: 1 });
    }

    async getById(entryId: string): Promise<MealPlanEntry | null> {
        return this.collection().findOne({ id: entryId });
    }

    async findForUserBetween(userId: string, from: string, to: string): Promise<MealPlanEntry[]> {
        // Day strings sort lexically, so a plain range on `date` selects the window.
        return this.collection()
            .find({ date: { $gte: from, $lte: to }, $or: [{ ownerId: userId }, { 'users.id': userId }] })
            .sort({ date: 1 })
            .toArray();
    }

    async insert(entry: MealPlanEntry): Promise<MealPlanEntry> {
        await this.collection().insertOne(entry);

        return entry;
    }

    async update(entryId: string, entry: MealPlanEntry): Promise<MealPlanEntry> {
        // Match absence as well as array contents for entries created before sharing.
        const users = entry.users === undefined ? { $exists: false } : entry.users;

        const updated = await this.collection().findOneAndReplace({ id: entryId, users }, entry, {
            returnDocument: 'after',
        });

        if (updated) return updated;

        if (!(await this.getById(entryId))) {
            throw new Error('Meal plan entry not found');
        }

        throw Object.assign(new Error('Meal plan membership changed'), { status: 409 });
    }

    async deleteById(entryId: string): Promise<void> {
        await this.collection().deleteOne({ id: entryId });
    }

    async removeMemberFromAll(memberId: string, ownerId: string): Promise<void> {
        await this.collection().updateMany({ ownerId }, { $pull: { users: { id: memberId } } });
    }

    async deleteOwnedBy(userId: string): Promise<void> {
        await this.collection().deleteMany({ ownerId: userId });
    }

    async removeMemberEverywhere(memberId: string): Promise<void> {
        await this.collection().updateMany({ 'users.id': memberId }, { $pull: { users: { id: memberId } } });
    }
}
