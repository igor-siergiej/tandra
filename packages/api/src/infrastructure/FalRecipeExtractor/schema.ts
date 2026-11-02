import { z } from 'zod';

import { stringArrayField } from '../zodHelpers';

export const extractedRecipeSchema: z.ZodType<{ title: string; ingredients: string[]; instructions: string[] }> = z
    .object({
        title: z.string().catch(''),
        ingredients: stringArrayField(),
        instructions: stringArrayField(),
    })
    .transform((recipe) => ({
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
    }));
