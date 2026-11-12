import { z } from 'zod';

import type { RecipeEstimate } from '../../domain/WikibooksIngest/types';

const MAX_MINUTES = 7 * 24 * 60;
const MAX_SERVINGS = 100;

// A field the model got wrong is dropped, not fatal: the recipe simply goes without that estimate.
const minutes = z.number().int().min(1).max(MAX_MINUTES).optional().catch(undefined);

export const recipeEstimateSchema: z.ZodType<RecipeEstimate> = z
    .object({
        prepTime: minutes,
        cookTime: minutes,
        servings: z.number().int().min(1).max(MAX_SERVINGS).optional().catch(undefined),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional().catch(undefined),
    })
    // Copies only the fields that survived validation.
    // fallow-ignore-next-line complexity
    .transform((raw): RecipeEstimate => {
        const estimate: RecipeEstimate = {};

        if (raw.prepTime !== undefined) estimate.prepTime = raw.prepTime;

        if (raw.cookTime !== undefined) estimate.cookTime = raw.cookTime;

        if (raw.servings !== undefined) estimate.servings = raw.servings;

        if (raw.difficulty !== undefined) estimate.difficulty = raw.difficulty;

        return estimate;
    });
