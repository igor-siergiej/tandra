import type { Logger } from '@imapps/api-utils';
import type { Ingredient, Recipe, RecipeDifficulty, User } from '@tandra/types';

import { AuthorizationService } from '../AuthorizationService';
import type { FriendService } from '../FriendService';
import type { IdGenerator } from '../IdGenerator';
import type { RecipeImageService } from '../RecipeImageService';
import type { RecipeRepository } from '../RecipeRepository';
import { resolveFriendMembers } from '../SharedMembers';

interface RecipeTagger {
    generateTags(title: string, ingredients: Ingredient[], instructions?: string[]): Promise<string[]>;
}

interface IngredientSubstituter {
    generateSubstitutes(ingredientName: string, recipeTitle?: string): Promise<string[]>;
}

const normalizeTag = (t: string) => t.trim().toLowerCase();

const mergeTags = (manual: string[], aiTags: string[]): string[] => {
    const normalizedManual = manual.map(normalizeTag).filter(Boolean);
    const seen = new Set(normalizedManual);
    const merged = [...normalizedManual];
    for (const tag of aiTags.map(normalizeTag).filter(Boolean)) {
        if (!seen.has(tag)) {
            seen.add(tag);
            merged.push(tag);
        }
    }
    return merged;
};

export class RecipeService {
    private readonly authorizationService: AuthorizationService;

    constructor(
        private recipeRepository: RecipeRepository,
        private idGenerator: IdGenerator,
        private logger?: Logger,
        authorizationService?: AuthorizationService,
        private recipeImageService?: RecipeImageService,
        private readonly friendService?: FriendService,
        private readonly tagger?: RecipeTagger,
        private readonly substituter?: IngredientSubstituter
    ) {
        this.authorizationService = authorizationService ?? new AuthorizationService();
    }

    async suggestSubstitutes(ingredientName: string, recipeTitle?: string): Promise<string[]> {
        if (!this.substituter) {
            throw Object.assign(new Error('Ingredient substitution is not configured'), { status: 503 });
        }
        try {
            return await this.substituter.generateSubstitutes(ingredientName, recipeTitle);
        } catch (error) {
            this.logger?.warn('Ingredient substitute generation failed', { ingredientName, recipeTitle, error });
            throw Object.assign(new Error('Failed to generate ingredient substitutes'), { status: 502 });
        }
    }

    // Runs after the create response is sent: the tagger can take ~30 s (timeout x retries) and a failure must never
    // fail or delay the create. Tags are added atomically so a concurrent edit is not overwritten.
    private async tagInBackground(recipe: Recipe, instructions?: string[]): Promise<void> {
        if (!this.tagger) return;
        try {
            const generated = await this.tagger.generateTags(recipe.title, recipe.ingredients, instructions);
            const fresh = mergeTags(recipe.tags ?? [], generated).slice((recipe.tags ?? []).length);
            if (fresh.length > 0) {
                await this.recipeRepository.addTags(recipe.id, fresh);
            }
        } catch (error) {
            this.logger?.warn('Recipe tag generation failed, continuing without AI tags', {
                recipeId: recipe.id,
                recipeTitle: recipe.title,
                error,
            });
        }
    }

    /** Owner first, then the friends the recipe is shared with (all by default, or the chosen subset). */
    private async resolveSharedUsers(
        title: string,
        owner: User,
        selectedFriendIds?: Array<string>
    ): Promise<Array<User>> {
        const members = await resolveFriendMembers(this.friendService, owner.id, selectedFriendIds);

        this.logger?.info(
            selectedFriendIds === undefined ? 'Recipe auto-shared with friends' : 'Recipe shared with selected friends',
            { recipeTitle: title, owner: owner.username, sharedWithCount: members.length }
        );

        return [owner, ...members];
    }

    async createRecipe(
        title: string,
        ingredients: Ingredient[],
        ownerId: string,
        owner: User,
        link?: string,
        instructions?: string[],
        selectedUsers?: string[],
        id?: string,
        tags?: string[],
        prepTime?: number,
        cookTime?: number,
        servings?: number,
        difficulty?: RecipeDifficulty,
        attribution?: string
    ): Promise<Recipe> {
        try {
            if (id) {
                const existing = await this.recipeRepository.getById(id);
                if (existing && existing.ownerId === ownerId) {
                    return existing; // idempotent replay
                }
            }
            const users = await this.resolveSharedUsers(title, owner, selectedUsers);
            const mergedTags = mergeTags(tags ?? [], []);
            const recipe: Recipe = {
                id: id ?? this.idGenerator.generate(),
                title,
                ingredients: ingredients.map((ing) => ({
                    ...ing,
                    id: this.idGenerator.generate(),
                })),
                ownerId,
                users,
                dateAdded: new Date(),
                ...(link !== undefined && { link }),
                ...(instructions !== undefined && { instructions }),
                ...(mergedTags.length > 0 && { tags: mergedTags }),
                ...(prepTime !== undefined && { prepTime }),
                ...(cookTime !== undefined && { cookTime }),
                ...(servings !== undefined && { servings }),
                ...(difficulty !== undefined && { difficulty }),
                ...(attribution !== undefined && { attribution }),
            };
            const created = await this.recipeRepository.insert(recipe);
            void this.tagInBackground(created, instructions);
            this.logger?.info('Recipe created', {
                recipeId: created.id,
                recipeTitle: title,
                owner: owner.username,
                ingredientCount: created.ingredients.length,
            });
            return created;
        } catch (error) {
            this.logger?.error('Failed to create recipe', {
                recipeTitle: title,
                owner: owner.username,
                error,
            });
            throw error;
        }
    }

    async getRecipe(recipeId: string): Promise<Recipe> {
        const recipe = await this.recipeRepository.getById(recipeId);
        if (!recipe) {
            const error = new Error('Recipe not found');
            Object.assign(error, { status: 404 });
            throw error;
        }
        return recipe;
    }

    async getRecipesByUserId(userId: string): Promise<Recipe[]> {
        return this.recipeRepository.findByUserId(userId);
    }

    async updateRecipe(
        recipeId: string,
        title: string,
        ingredients: Ingredient[],
        ownerId: string,
        link?: string,
        instructions?: string[],
        tags?: string[],
        prepTime?: number,
        cookTime?: number,
        servings?: number,
        difficulty?: RecipeDifficulty
    ): Promise<Recipe> {
        try {
            const recipe = await this.getRecipe(recipeId);
            if (!this.authorizationService.isOwner(recipe, ownerId)) {
                const error = new Error('Only recipe owner can update');
                Object.assign(error, { status: 403 });
                throw error;
            }
            recipe.title = title;
            recipe.ingredients = ingredients.map((ing) => ({
                ...ing,
                id: ing.id || this.idGenerator.generate(),
            }));
            recipe.link = link;
            recipe.instructions = instructions;
            recipe.tags = tags;
            recipe.prepTime = prepTime;
            recipe.cookTime = cookTime;
            recipe.servings = servings;
            recipe.difficulty = difficulty;
            const updated = await this.recipeRepository.update(recipeId, recipe);
            this.logger?.info('Recipe updated', {
                recipeId,
                recipeTitle: title,
                ingredientCount: updated.ingredients.length,
            });
            return updated;
        } catch (error) {
            this.logger?.error('Failed to update recipe', {
                recipeId,
                recipeTitle: title,
                error,
            });
            throw error;
        }
    }

    async deleteRecipe(recipeId: string, userId: string): Promise<void> {
        try {
            const recipe = await this.getRecipe(recipeId);
            if (!this.authorizationService.isOwner(recipe, userId)) {
                const error = new Error('Only recipe owner can delete');
                Object.assign(error, { status: 403 });
                throw error;
            }
            await this.recipeRepository.deleteById(recipeId);
            this.logger?.info('Recipe deleted', {
                recipeId,
                recipeTitle: recipe.title,
            });
        } catch (error) {
            this.logger?.error('Failed to delete recipe', {
                recipeId,
                error,
            });
            throw error;
        }
    }

    /**
     * Add a friend to an existing recipe
     * Only the recipe owner can add users, and only friends of the owner can be added
     */
    async addUserToRecipe(recipeId: string, friendId: string, requestingUserId: string): Promise<Recipe> {
        const recipe = await this.getRecipe(recipeId);

        // Authorization: only owner can add users
        if (!this.authorizationService.canManageUsers(recipe, requestingUserId)) {
            throw Object.assign(new Error('Only recipe owner can add users'), { status: 403 });
        }

        // Validate friendship by id
        if (!this.friendService || !(await this.friendService.areFriends(requestingUserId, friendId))) {
            throw Object.assign(new Error('Can only share with friends'), { status: 403 });
        }

        // Check if user is already in the recipe
        if (recipe.users.some((u) => u.id === friendId)) {
            throw Object.assign(new Error('User is already in this recipe'), { status: 400 });
        }

        const [friend] = (await this.friendService.listFriends(requestingUserId)).filter((f) => f.id === friendId);

        const updated = await this.recipeRepository.addUser(recipeId, friend);
        this.logger?.info('User added to recipe', {
            recipeId,
            addedUser: friend.username,
            addedBy: requestingUserId,
        });
        return updated;
    }

    async removeUserFromRecipe(recipeId: string, userId: string, ownerId: string): Promise<Recipe> {
        try {
            const recipe = await this.getRecipe(recipeId);
            if (!this.authorizationService.canManageUsers(recipe, ownerId)) {
                const error = new Error('Only recipe owner can remove users');
                Object.assign(error, { status: 403 });
                throw error;
            }
            if (userId === recipe.ownerId) {
                const error = new Error('Cannot remove recipe owner');
                Object.assign(error, { status: 400 });
                throw error;
            }
            if (recipe.users.length === 1) {
                const error = new Error('Cannot remove last user');
                Object.assign(error, { status: 400 });
                throw error;
            }
            const updated = await this.recipeRepository.removeUser(recipeId, userId);
            this.logger?.info('User removed from recipe', {
                recipeId,
                removedUserId: userId,
                removedBy: ownerId,
            });
            return updated;
        } catch (error) {
            this.logger?.error('Failed to remove user from recipe', {
                recipeId,
                userId,
                error,
            });
            throw error;
        }
    }

    async regenerateImage(recipeId: string, userId: string): Promise<Recipe> {
        if (!this.recipeImageService) {
            const error = new Error('Image service not configured');
            Object.assign(error, { status: 503 });
            throw error;
        }
        const recipe = await this.getRecipe(recipeId);
        if (!this.authorizationService.isOwner(recipe, userId)) {
            const error = new Error('Only recipe owner can regenerate image');
            Object.assign(error, { status: 403 });
            throw error;
        }
        // Generate at most once per recipe. If an AI image already exists, this is a no-op
        // (no paid API call); reverting the cover to it is handled by revertToAiImage.
        if (recipe.aiImageKey) {
            return recipe;
        }
        const key = await this.recipeImageService.generateRecipeImage(recipeId, recipe.title, recipe.ingredients);
        recipe.aiImageKey = key;
        recipe.coverImageKey = key;
        return this.recipeRepository.update(recipeId, recipe);
    }

    /** Point the cover back at the already-generated AI image. No generation, no API cost. */
    async revertToAiImage(recipeId: string, userId: string): Promise<Recipe> {
        const recipe = await this.getRecipe(recipeId);
        if (!this.authorizationService.isOwner(recipe, userId)) {
            const error = new Error('Only recipe owner can update image');
            Object.assign(error, { status: 403 });
            throw error;
        }
        // Backfill: legacy recipes stored the AI image under coverImageKey with no aiImageKey.
        const aiKey =
            recipe.aiImageKey ?? (recipe.coverImageKey?.startsWith('recipe-image/') ? recipe.coverImageKey : undefined);
        if (!aiKey) {
            const error = new Error('No AI image available to revert to');
            Object.assign(error, { status: 400 });
            throw error;
        }
        recipe.aiImageKey = aiKey;
        recipe.coverImageKey = aiKey;
        return this.recipeRepository.update(recipeId, recipe);
    }

    async setCoverImageKey(recipeId: string, coverImageKey: string, userId: string): Promise<Recipe> {
        try {
            const recipe = await this.getRecipe(recipeId);
            if (!this.authorizationService.isOwner(recipe, userId)) {
                const error = new Error('Only recipe owner can update image');
                Object.assign(error, { status: 403 });
                throw error;
            }
            // Preserve a legacy AI image key (stored only in coverImageKey) before it is overwritten,
            // so the cover can later be reverted to it for free.
            if (!recipe.aiImageKey && recipe.coverImageKey?.startsWith('recipe-image/')) {
                recipe.aiImageKey = recipe.coverImageKey;
            }
            recipe.coverImageKey = coverImageKey;
            const updated = await this.recipeRepository.update(recipeId, recipe);
            this.logger?.info('Recipe cover image updated', {
                recipeId,
                coverImageKey,
            });
            return updated;
        } catch (error) {
            this.logger?.error('Failed to update recipe cover image', {
                recipeId,
                error,
            });
            throw error;
        }
    }
}
