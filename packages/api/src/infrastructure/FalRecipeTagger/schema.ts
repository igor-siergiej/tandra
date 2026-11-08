import { z } from 'zod';

import { stringArrayField } from '../zodHelpers';

export const taggedRecipeSchema: z.ZodType<{ tags: string[] }> = z
    .object({ tags: stringArrayField() })
    .transform((recipe) => ({ tags: recipe.tags }));
