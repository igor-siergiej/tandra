import { beforeEach, describe, expect, it } from 'bun:test';

import type { Ingredient, Recipe, User } from '@tandra/types';

import { RecipeService } from './index';

class MockRepository {
    private store = new Map<string, Recipe>();

    async insert(recipe: Recipe): Promise<Recipe> {
        this.store.set(recipe.id, recipe);

        return recipe;
    }

    async getById(id: string): Promise<Recipe | null> {
        return this.store.get(id) ?? null;
    }

    async update(id: string, recipe: Recipe): Promise<Recipe> {
        this.store.set(id, recipe);

        return recipe;
    }

    async deleteById(id: string): Promise<void> {
        this.store.delete(id);
    }

    async findByUserId(_userId: string): Promise<Recipe[]> {
        return [];
    }

    async addUser(id: string, user: User): Promise<Recipe> {
        const r = this.store.get(id);

        if (!r) throw new Error(`Recipe ${id} not found`);
        r.users.push(user);
        this.store.set(id, r);

        return r;
    }

    async removeUser(id: string, userId: string): Promise<Recipe> {
        const r = this.store.get(id);

        if (!r) throw new Error(`Recipe ${id} not found`);
        r.users = r.users.filter((u) => u.id !== userId);
        this.store.set(id, r);

        return r;
    }

    async addTags(id: string, tags: string[]): Promise<void> {
        const r = this.store.get(id);

        if (r) {
            // Replace the stored document (as a DB write would) rather than mutate the object a caller already holds.
            this.store.set(id, { ...r, tags: [...new Set([...(r.tags ?? []), ...tags])] });
        }
    }

    async setCoverImageKey(id: string, key: string): Promise<void> {
        const r = this.store.get(id);

        if (r) {
            r.coverImageKey = key;
            this.store.set(id, r);
        }
    }

    reset() {
        this.store.clear();
    }
}

class MockIdGenerator {
    private n = 0;
    generate() {
        return `id-${++this.n}`;
    }
    reset() {
        this.n = 0;
    }
}

const repo = new MockRepository();
const ids = new MockIdGenerator();
const owner: User = { id: 'user-1', username: 'alice' };

const user2: User = { id: 'user-2', username: 'bob' };
const user3: User = { id: 'user-3', username: 'carol' };

class MockFriends {
    private friendsById = new Map<string, Map<string, User>>();

    add(a: User, b: User) {
        this.link(a, b);
        this.link(b, a);
    }

    private link(from: User, to: User) {
        if (!this.friendsById.has(from.id)) this.friendsById.set(from.id, new Map());
        this.friendsById.get(from.id)?.set(to.id, to);
    }

    async areFriends(a: string, b: string): Promise<boolean> {
        return this.friendsById.get(a)?.has(b) ?? false;
    }

    async listFriends(userId: string): Promise<User[]> {
        return [...(this.friendsById.get(userId)?.values() ?? [])];
    }

    reset() {
        this.friendsById.clear();
    }
}

const friends = new MockFriends();

beforeEach(() => {
    repo.reset();
    ids.reset();
    friends.reset();
});

describe('RecipeService.createRecipe', () => {
    it('persists link and instructions when provided', async () => {
        const svc = new RecipeService(repo as any, ids);

        const recipe = await svc.createRecipe('Carbonara', [], owner.id, owner, 'https://example.com/carbonara', [
            'Boil water',
            'Cook pasta',
        ]);

        expect(recipe.link).toBe('https://example.com/carbonara');
        expect(recipe.instructions).toEqual(['Boil water', 'Cook pasta']);
    });

    it('creates recipe without link or instructions when omitted', async () => {
        const svc = new RecipeService(repo as any, ids);
        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner);
        expect(recipe.link).toBeUndefined();
        expect(recipe.instructions).toBeUndefined();
    });

    it('creates recipe with only owner when no friend service configured', async () => {
        const svc = new RecipeService(repo as any, ids);
        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner);
        expect(recipe.users).toHaveLength(1);
        expect(recipe.users[0].id).toBe(owner.id);
    });

    it("creates a recipe with the owner plus the owner's friends", async () => {
        friends.add(owner, user2);
        friends.add(owner, user3);
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner);
        expect(recipe.users).toHaveLength(3);
        expect(recipe.users.map((u) => u.id).sort()).toEqual([owner.id, user2.id, user3.id].sort());
    });

    it('creates a recipe with only the explicitly selected friend subset', async () => {
        friends.add(owner, user2);
        friends.add(owner, user3);
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner, undefined, undefined, [user2.id]);
        expect(recipe.users.map((u) => u.id)).toEqual([owner.id, user2.id]);
    });

    it('rejects sharing with a non-friend id (403)', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        await expect(
            svc.createRecipe('Pasta', [], owner.id, owner, undefined, undefined, ['not-a-friend'])
        ).rejects.toMatchObject({ status: 403 });
    });

    it('silently seeds the owner only when no friend service is configured, ignoring selected friend ids', async () => {
        const svc = new RecipeService(repo as any, ids);
        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner, undefined, undefined, [user2.id]);
        expect(recipe.users).toEqual([owner]);
    });

    it('uses the caller-provided id when given', async () => {
        const svc = new RecipeService(repo as any, ids);

        const recipe = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            [],
            'client-recipe-uuid'
        );

        expect(recipe.id).toBe('client-recipe-uuid');
    });

    it('returns the existing recipe without re-insert when id+owner already exist', async () => {
        const svc = new RecipeService(repo as any, ids);

        const first = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            [],
            'client-recipe-uuid'
        );

        const second = await svc.createRecipe(
            'Risotto',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            [],
            'client-recipe-uuid'
        );

        expect(second).toBe(first);
        expect(second.title).toBe('Pasta');
    });

    it('persists prepTime, cookTime, servings and difficulty when provided', async () => {
        const svc = new RecipeService(repo as any, ids);

        const recipe = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            20,
            15,
            4,
            'easy'
        );

        expect(recipe.prepTime).toBe(20);
        expect(recipe.cookTime).toBe(15);
        expect(recipe.servings).toBe(4);
        expect(recipe.difficulty).toBe('easy');
    });

    it('omits prepTime, cookTime, servings and difficulty when not provided', async () => {
        const svc = new RecipeService(repo as any, ids);
        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner);
        expect(recipe.prepTime).toBeUndefined();
        expect(recipe.cookTime).toBeUndefined();
        expect(recipe.servings).toBeUndefined();
        expect(recipe.difficulty).toBeUndefined();
    });
});

class MockRecipeTagger {
    calls: Array<{ title: string; ingredients: Ingredient[]; instructions?: string[] }> = [];
    tags: string[] = [];
    shouldReject = false;

    async generateTags(title: string, ingredients: Ingredient[], instructions?: string[]): Promise<string[]> {
        this.calls.push({ title, ingredients, instructions });

        if (this.shouldReject) throw new Error('tagging failed');

        return this.tags;
    }

    reset() {
        this.calls = [];
        this.tags = [];
        this.shouldReject = false;
    }
}

const mockTagger = new MockRecipeTagger();

const flushBackground = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    mockTagger.reset();
});

describe('RecipeService.createRecipe tags', () => {
    it('stores only manual tags when no tagger is configured', async () => {
        const svc = new RecipeService(repo as any, ids);

        const recipe = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            ['Dinner', 'quick']
        );

        expect(recipe.tags).toEqual(['dinner', 'quick']);
    });

    it('does not wait for the tagger before returning the created recipe', async () => {
        let release: (tags: string[]) => void = () => {};

        const slowTagger = {
            generateTags: () =>
                new Promise<string[]>((resolve) => {
                    release = resolve;
                }),
        };

        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, undefined, slowTagger as any);

        const recipe = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            ['dinner']
        );

        expect(recipe.tags).toEqual(['dinner']);
        release(['pasta']);
    });

    it('adds AI tags in the background, deduping case-insensitively against manual tags', async () => {
        mockTagger.tags = ['Pasta', 'egg', 'pork'];
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, undefined, mockTagger as any);

        const recipe = await svc.createRecipe(
            'Carbonara',
            [{ id: '1', name: 'egg' }],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            ['PASTA', 'creamy']
        );

        expect(recipe.tags).toEqual(['pasta', 'creamy']);

        await flushBackground();

        expect((await repo.getById(recipe.id))?.tags).toEqual(['pasta', 'creamy', 'egg', 'pork']);
        expect(mockTagger.calls).toEqual([
            { title: 'Carbonara', ingredients: [expect.objectContaining({ name: 'egg' })], instructions: undefined },
        ]);
    });

    it('still creates the recipe with manual tags when the tagger throws', async () => {
        mockTagger.shouldReject = true;
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, undefined, mockTagger as any);

        const recipe = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            ['dinner']
        );

        await flushBackground();

        expect((await repo.getById(recipe.id))?.tags).toEqual(['dinner']);
    });

    it('creates a recipe with no tags when none are manual and the tagger returns none', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, undefined, mockTagger as any);

        const recipe = await svc.createRecipe('Pasta', [], owner.id, owner);
        await flushBackground();

        expect((await repo.getById(recipe.id))?.tags).toBeUndefined();
    });
});

class MockIngredientSubstituter {
    calls: Array<{ ingredientName: string; recipeTitle?: string }> = [];
    substitutes: string[] = [];
    shouldReject = false;

    async generateSubstitutes(ingredientName: string, recipeTitle?: string): Promise<string[]> {
        this.calls.push({ ingredientName, recipeTitle });

        if (this.shouldReject) throw new Error('substitution failed');

        return this.substitutes;
    }

    reset() {
        this.calls = [];
        this.substitutes = [];
        this.shouldReject = false;
    }
}

const mockSubstituter = new MockIngredientSubstituter();

beforeEach(() => {
    mockSubstituter.reset();
});

describe('RecipeService.suggestSubstitutes', () => {
    it('throws 503 when no substituter is configured', async () => {
        const svc = new RecipeService(repo as any, ids);
        await expect(svc.suggestSubstitutes('butter')).rejects.toMatchObject({ status: 503 });
    });

    it('returns substitutes from the configured substituter', async () => {
        mockSubstituter.substitutes = ['margarine', 'coconut oil'];

        const svc = new RecipeService(
            repo as any,
            ids,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            mockSubstituter as any
        );

        const substitutes = await svc.suggestSubstitutes('butter', 'Carbonara');
        expect(substitutes).toEqual(['margarine', 'coconut oil']);
        expect(mockSubstituter.calls).toEqual([{ ingredientName: 'butter', recipeTitle: 'Carbonara' }]);
    });

    it('throws 502 when the substituter throws', async () => {
        mockSubstituter.shouldReject = true;

        const svc = new RecipeService(
            repo as any,
            ids,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            mockSubstituter as any
        );

        await expect(svc.suggestSubstitutes('butter')).rejects.toMatchObject({ status: 502 });
    });
});

class MockRecipeImageService {
    calls: Array<{ recipeId: string; title: string; ingredients: Ingredient[] }> = [];
    shouldReject = false;

    async generateRecipeImage(recipeId: string, title: string, ingredients: Ingredient[]): Promise<string> {
        this.calls.push({ recipeId, title, ingredients });

        if (this.shouldReject) throw new Error('generation failed');

        return `recipe-image/${recipeId}`;
    }

    reset() {
        this.calls = [];
        this.shouldReject = false;
    }
}

const mockImageService = new MockRecipeImageService();

beforeEach(() => {
    mockImageService.reset();
});

describe('RecipeService.regenerateImage', () => {
    it('generates image and sets both cover and ai keys when no ai image exists', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [{ id: '1', name: 'flour' }], owner.id, owner);

        const result = await svc.regenerateImage(created.id, owner.id);

        expect(mockImageService.calls.length).toBe(1);
        expect(mockImageService.calls[0].recipeId).toBe(created.id);
        expect(result.coverImageKey).toBe(`recipe-image/${created.id}`);
        expect(result.aiImageKey).toBe(`recipe-image/${created.id}`);
    });

    it('does not generate again once an ai image exists (no API cost)', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await svc.regenerateImage(created.id, owner.id); // first gen
        // user replaced cover with an upload
        await svc.setCoverImageKey(created.id, 'recipe-upload/u/r/1', owner.id);

        const result = await svc.regenerateImage(created.id, owner.id);

        expect(mockImageService.calls.length).toBe(1); // still just the one generation
        expect(result.coverImageKey).toBe('recipe-upload/u/r/1'); // unchanged
    });

    it('throws 503 when image service not configured', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);

        await expect(svc.regenerateImage(created.id, owner.id)).rejects.toMatchObject({ status: 503 });
    });

    it('throws 403 when non-owner tries to regenerate', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);

        await expect(svc.regenerateImage(created.id, 'other-user')).rejects.toMatchObject({ status: 403 });
    });
});

describe('RecipeService.revertToAiImage', () => {
    it('points cover back at the ai image without generating', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await svc.regenerateImage(created.id, owner.id);
        await svc.setCoverImageKey(created.id, 'recipe-upload/u/r/1', owner.id);

        const result = await svc.revertToAiImage(created.id, owner.id);

        expect(mockImageService.calls.length).toBe(1); // no extra generation
        expect(result.coverImageKey).toBe(`recipe-image/${created.id}`);
    });

    it('backfills ai key from a legacy recipe-image cover key', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await svc.setCoverImageKey(created.id, 'recipe-image/legacy-key', owner.id); // no aiImageKey
        await svc.setCoverImageKey(created.id, 'recipe-upload/u/r/1', owner.id);

        const result = await svc.revertToAiImage(created.id, owner.id);

        expect(result.coverImageKey).toBe('recipe-image/legacy-key');
        expect(result.aiImageKey).toBe('recipe-image/legacy-key');
    });

    it('throws 400 when there is no ai image to revert to', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await svc.setCoverImageKey(created.id, 'recipe-upload/u/r/1', owner.id);

        await expect(svc.revertToAiImage(created.id, owner.id)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 403 when a non-owner tries to revert', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, mockImageService as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);

        await expect(svc.revertToAiImage(created.id, 'other-user')).rejects.toMatchObject({ status: 403 });
    });
});

describe('RecipeService.getRecipe', () => {
    it('throws 404 when recipe not found', async () => {
        const svc = new RecipeService(repo as any, ids);
        await expect(svc.getRecipe('missing-id')).rejects.toMatchObject({ status: 404, message: 'Recipe not found' });
    });

    it('returns recipe when found', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        const found = await svc.getRecipe(created.id);
        expect(found.id).toBe(created.id);
    });
});

describe('RecipeService.getRecipesByUserId', () => {
    it('returns recipes for user', async () => {
        const svc = new RecipeService(repo as any, ids);
        const results = await svc.getRecipesByUserId(owner.id);
        expect(Array.isArray(results)).toBe(true);
    });
});

describe('RecipeService.updateRecipe', () => {
    it('persists link and instructions on update', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);

        const updated = await svc.updateRecipe(created.id, 'Pasta v2', [], owner.id, 'https://example.com/pasta', [
            'Step 1',
            'Step 2',
        ]);

        expect(updated.link).toBe('https://example.com/pasta');
        expect(updated.instructions).toEqual(['Step 1', 'Step 2']);
    });

    it('clears link and instructions when passed as undefined', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner, 'https://example.com', ['Step 1']);
        const updated = await svc.updateRecipe(created.id, 'Pasta', [], owner.id, undefined, undefined);
        expect(updated.link).toBeUndefined();
        expect(updated.instructions).toBeUndefined();
    });

    it('throws 403 when non-owner tries to update', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await expect(svc.updateRecipe(created.id, 'Pasta', [], 'other-user')).rejects.toMatchObject({ status: 403 });
    });

    it('throws when recipe not found', async () => {
        const svc = new RecipeService(repo as any, ids);
        await expect(svc.updateRecipe('missing', 'Pasta', [], owner.id)).rejects.toMatchObject({ status: 404 });
    });

    it('passes tags through on update', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);

        const updated = await svc.updateRecipe(created.id, 'Pasta', [], owner.id, undefined, undefined, [
            'dinner',
            'quick',
        ]);

        expect(updated.tags).toEqual(['dinner', 'quick']);
    });

    it('removes a tag by omitting it from the passed-through array', async () => {
        const svc = new RecipeService(repo as any, ids);

        const created = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            ['dinner', 'quick']
        );

        const updated = await svc.updateRecipe(created.id, 'Pasta', [], owner.id, undefined, undefined, ['dinner']);
        expect(updated.tags).toEqual(['dinner']);
    });

    it('persists prepTime, cookTime, servings and difficulty on update', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);

        const updated = await svc.updateRecipe(
            created.id,
            'Pasta',
            [],
            owner.id,
            undefined,
            undefined,
            undefined,
            25,
            30,
            6,
            'hard'
        );

        expect(updated.prepTime).toBe(25);
        expect(updated.cookTime).toBe(30);
        expect(updated.servings).toBe(6);
        expect(updated.difficulty).toBe('hard');
    });

    it('clears prepTime, cookTime, servings and difficulty when passed as undefined', async () => {
        const svc = new RecipeService(repo as any, ids);

        const created = await svc.createRecipe(
            'Pasta',
            [],
            owner.id,
            owner,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            20,
            15,
            4,
            'easy'
        );

        const updated = await svc.updateRecipe(created.id, 'Pasta', [], owner.id);
        expect(updated.prepTime).toBeUndefined();
        expect(updated.cookTime).toBeUndefined();
        expect(updated.servings).toBeUndefined();
        expect(updated.difficulty).toBeUndefined();
    });
});

describe('RecipeService.deleteRecipe', () => {
    it('deletes recipe when owner', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await expect(svc.deleteRecipe(created.id, owner.id)).resolves.toBeUndefined();
        await expect(svc.getRecipe(created.id)).rejects.toMatchObject({ status: 404 });
    });

    it('throws 403 when non-owner tries to delete', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await expect(svc.deleteRecipe(created.id, 'other-user')).rejects.toMatchObject({ status: 403 });
    });

    it('throws when recipe not found', async () => {
        const svc = new RecipeService(repo as any, ids);
        await expect(svc.deleteRecipe('missing', owner.id)).rejects.toMatchObject({ status: 404 });
    });
});

describe('RecipeService.addUserToRecipe', () => {
    it('adds a friend to the recipe', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        friends.add(owner, user2);
        const updated = await svc.addUserToRecipe(created.id, user2.id, owner.id);
        expect(updated.users.some((u) => u.id === user2.id)).toBe(true);
    });

    it('throws 403 when non-owner tries to add user', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        friends.add(owner, user2);
        await expect(svc.addUserToRecipe(created.id, user2.id, 'other-user')).rejects.toMatchObject({ status: 403 });
    });

    it('throws 403 when the target id is not a friend', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await expect(svc.addUserToRecipe(created.id, 'not-a-friend', owner.id)).rejects.toMatchObject({
            status: 403,
        });
    });

    it('throws 400 when user already in recipe', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        friends.add(owner, user2);
        await svc.addUserToRecipe(created.id, user2.id, owner.id);
        await expect(svc.addUserToRecipe(created.id, user2.id, owner.id)).rejects.toMatchObject({ status: 400 });
    });

    it('throws when recipe not found', async () => {
        friends.add(owner, user2);
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        await expect(svc.addUserToRecipe('missing', user2.id, owner.id)).rejects.toMatchObject({ status: 404 });
    });
});

describe('RecipeService.removeUserFromRecipe', () => {
    it('removes user from recipe', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        friends.add(owner, user2);
        await svc.addUserToRecipe(created.id, user2.id, owner.id);
        const updated = await svc.removeUserFromRecipe(created.id, user2.id, owner.id);
        expect(updated.users.some((u) => u.id === user2.id)).toBe(false);
    });

    it('throws 403 when non-owner tries to remove user', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        friends.add(owner, user2);
        await svc.addUserToRecipe(created.id, user2.id, owner.id);
        await expect(svc.removeUserFromRecipe(created.id, user2.id, 'other-user')).rejects.toMatchObject({
            status: 403,
        });
    });

    it('throws 400 when trying to remove owner', async () => {
        const svc = new RecipeService(repo as any, ids, undefined, undefined, undefined, friends as any);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        friends.add(owner, user2);
        await svc.addUserToRecipe(created.id, user2.id, owner.id);
        await expect(svc.removeUserFromRecipe(created.id, owner.id, owner.id)).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when trying to remove last user', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await expect(svc.removeUserFromRecipe(created.id, user2.id, owner.id)).rejects.toMatchObject({ status: 400 });
    });

    it('throws when recipe not found', async () => {
        const svc = new RecipeService(repo as any, ids);
        await expect(svc.removeUserFromRecipe('missing', user2.id, owner.id)).rejects.toMatchObject({ status: 404 });
    });
});

describe('RecipeService.setCoverImageKey', () => {
    it('sets cover image key when owner', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        const updated = await svc.setCoverImageKey(created.id, 'some-key', owner.id);
        expect(updated.coverImageKey).toBe('some-key');
    });

    it('throws 403 when non-owner tries to set image key', async () => {
        const svc = new RecipeService(repo as any, ids);
        const created = await svc.createRecipe('Pasta', [], owner.id, owner);
        await expect(svc.setCoverImageKey(created.id, 'key', 'other-user')).rejects.toMatchObject({ status: 403 });
    });

    it('throws when recipe not found', async () => {
        const svc = new RecipeService(repo as any, ids);
        await expect(svc.setCoverImageKey('missing', 'key', owner.id)).rejects.toMatchObject({ status: 404 });
    });
});
