import type { MongoDbConnection } from '@imapps/api-utils';
import type { Recipe, User } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { RecipeRepository } from '../../domain/RecipeRepository';

export class MongoRecipeRepository implements RecipeRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.Recipe);
    }

    // getById/update/addUser/removeUser filter on id and findByUserId on users.id; without these every request
    // scans the whole collection. Not unique: the create path does not rule out a repeated id in existing data,
    // and a failed unique build would stop startup.
    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ id: 1 });
        await this.collection().createIndex({ 'users.id': 1 });
    }

    async getById(recipeId: string): Promise<Recipe | null> {
        return this.collection().findOne({ id: recipeId });
    }

    async getAll(): Promise<Recipe[]> {
        return this.collection().find({}).toArray();
    }

    async findByUserId(userId: string): Promise<Recipe[]> {
        return this.collection().find({ 'users.id': userId }).toArray();
    }

    async insert(recipe: Recipe): Promise<Recipe> {
        await this.collection().insertOne(recipe);

        return recipe;
    }

    async update(recipeId: string, recipe: Recipe): Promise<Recipe> {
        await this.collection().findOneAndReplace({ id: recipeId }, recipe);
        const updated = await this.getById(recipeId);

        if (!updated) {
            throw new Error('Recipe not found');
        }

        return updated;
    }

    async deleteById(recipeId: string): Promise<void> {
        await this.collection().deleteOne({ id: recipeId });
    }

    async addUser(recipeId: string, user: User): Promise<Recipe> {
        await this.collection().findOneAndUpdate({ id: recipeId }, { $push: { users: user } });
        const updated = await this.getById(recipeId);

        if (!updated) {
            throw new Error('Recipe not found');
        }

        return updated;
    }

    async removeUser(recipeId: string, userId: string): Promise<Recipe> {
        await this.collection().findOneAndUpdate({ id: recipeId }, { $pull: { users: { id: userId } } });
        const updated = await this.getById(recipeId);

        if (!updated) {
            throw new Error('Recipe not found');
        }

        return updated;
    }

    async addTags(recipeId: string, tags: string[]): Promise<void> {
        await this.collection().findOneAndUpdate({ id: recipeId }, { $addToSet: { tags: { $each: tags } } });
    }

    async setCoverImageKey(recipeId: string, key: string): Promise<void> {
        await this.collection().findOneAndUpdate({ id: recipeId }, { $set: { coverImageKey: key } });
    }

    async removeMemberFromAll(memberId: string, ownerId: string): Promise<void> {
        await this.collection().updateMany({ ownerId }, { $pull: { users: { id: memberId } } });
    }
}
