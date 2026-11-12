import type { Logger } from '@imapps/api-utils';
import type { MealPlanEntry, Recipe } from '@tandra/types';

import type { FriendService } from '../FriendService';
import type { IdGenerator } from '../IdGenerator';
import type { MealPlanRepository } from '../MealPlanRepository';
import { resolveFriendMembers } from '../SharedMembers';

export interface CreateMealPlanInput {
    date: string;
    recipeId: string;
    servings: number;
    id?: string;
    userIds?: string[];
}

export interface UpdateMealPlanInput {
    date?: string;
    servings?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SERVINGS = 100;
const MAX_RANGE_DAYS = 62;

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

const assertDay = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
        throw fail(`${field} must be a YYYY-MM-DD day`, 400);
    }

    return value;
};

// fallow-ignore-next-line complexity
const assertServings = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_SERVINGS) {
        throw fail(`servings must be a number between 0 and ${MAX_SERVINGS}`, 400);
    }

    return value;
};

type RecipeLookup = { getRecipe(recipeId: string): Promise<Recipe> };

/** Recipes planned onto days, shared with friends the same way recipes and todos are. */
export class MealPlanService {
    constructor(
        private readonly repo: MealPlanRepository,
        private readonly idGenerator: IdGenerator,
        private readonly recipes: RecipeLookup,
        private readonly logger?: Logger,
        private readonly friendService?: FriendService
    ) {}

    private async getOwnedOrMember(entryId: string, actorId: string): Promise<MealPlanEntry> {
        const entry = await this.repo.getById(entryId);

        if (!entry) throw fail('Meal plan entry not found', 404);

        if (entry.ownerId !== actorId && !entry.users?.some((u) => u.id === actorId)) throw fail('Forbidden', 403);

        return entry;
    }

    // Validation, access check, sharing and insert read best as one linear flow.
    // fallow-ignore-next-line complexity
    async create(ownerId: string, input: CreateMealPlanInput): Promise<MealPlanEntry> {
        if (input.id) {
            const existing = await this.repo.getById(input.id);

            if (existing && existing.ownerId === ownerId) return existing; // idempotent replay
        }

        const date = assertDay(input.date, 'date');
        const servings = assertServings(input.servings);

        // A plan may only reference a recipe the planner can see; getRecipe 404s for unknown ids.
        const recipe = await this.recipes.getRecipe(input.recipeId);

        if (!recipe.users?.some((u) => u.id === ownerId)) throw fail('Forbidden', 403);

        const users = await resolveFriendMembers(this.friendService, ownerId, input.userIds);

        const entry: MealPlanEntry = {
            id: input.id ?? this.idGenerator.generate(),
            ownerId,
            date,
            recipeId: input.recipeId,
            servings,
            dateAdded: new Date(),
            ...(users.length > 0 && { users }),
        };

        await this.repo.insert(entry);
        this.logger?.info('Meal plan entry created', { entryId: entry.id, ownerId, date, recipeId: entry.recipeId });

        return entry;
    }

    async list(userId: string, from: string, to: string): Promise<MealPlanEntry[]> {
        const start = assertDay(from, 'from');
        const end = assertDay(to, 'to');
        const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;

        if (days < 0 || days > MAX_RANGE_DAYS) {
            throw fail(`from/to must span between 0 and ${MAX_RANGE_DAYS} days`, 400);
        }

        return this.repo.findForUserBetween(userId, start, end);
    }

    async update(entryId: string, actorId: string, input: UpdateMealPlanInput): Promise<MealPlanEntry> {
        const existing = await this.getOwnedOrMember(entryId, actorId);

        const merged: MealPlanEntry = {
            ...existing,
            ...(input.date !== undefined && { date: assertDay(input.date, 'date') }),
            ...(input.servings !== undefined && { servings: assertServings(input.servings) }),
        };

        return this.repo.update(entryId, merged);
    }

    async remove(entryId: string, ownerId: string): Promise<void> {
        const entry = await this.repo.getById(entryId);

        if (!entry) throw fail('Meal plan entry not found', 404);

        if (entry.ownerId !== ownerId) throw fail('Forbidden', 403);
        await this.repo.deleteById(entryId);
    }
}
