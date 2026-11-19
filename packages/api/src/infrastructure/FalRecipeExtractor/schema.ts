import { z } from 'zod';

import { stringArrayField } from '../zodHelpers';

export const extractedRecipeSchema: z.ZodType<{ title: string; ingredients: string[]; instructions: string[] }> = z
    .object({
        title: z
            .preprocess((value) => (typeof value === 'string' ? value : ''), z.string())
            .meta({ type: 'string' }),
        ingredients: stringArrayField(),
        instructions: stringArrayField(),
    })
    .transform((recipe): { title: string; ingredients: string[]; instructions: string[] } => ({
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
    }));
