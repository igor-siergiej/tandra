import type { Recipe, User } from '@tandra/types';

export interface RecipeRepository {
    ensureIndexes(): Promise<void>;
    getById(recipeId: string): Promise<Recipe | null>;
    getAll(): Promise<Recipe[]>;
    findByUserId(userId: string): Promise<Recipe[]>;
    insert(recipe: Recipe): Promise<Recipe>;
    update(recipeId: string, recipe: Recipe): Promise<Recipe>;
    deleteById(recipeId: string): Promise<void>;
    addUser(recipeId: string, user: User): Promise<Recipe>;
    removeUser(recipeId: string, userId: string): Promise<Recipe>;
    /** Adds tags atomically ($addToSet) so a background write cannot clobber a concurrent edit. */
    addTags(recipeId: string, tags: string[]): Promise<void>;
    setCoverImageKey(recipeId: string, key: string): Promise<void>;
    removeMemberFromAll(memberId: string, ownerId: string): Promise<void>;
    /** Every recipe the user owns (a legacy recipe with no owner counts when they are its only member). */
    findOwnedBy(userId: string): Promise<Recipe[]>;
    /** Deletes the recipes `findOwnedBy` returns. */
    deleteOwnedBy(userId: string): Promise<void>;
    /** Removes the user from `users[]` on every recipe, whoever owns it. */
    removeMemberEverywhere(memberId: string): Promise<void>;
}
