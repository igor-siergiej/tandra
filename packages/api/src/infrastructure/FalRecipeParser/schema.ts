import { z } from 'zod';

import type { ParsedRecipe } from '../../domain/RecipeImportService/types';
import { stringArrayField } from '../zodHelpers';

const ingredientSchema = z
    .object({
        name: z.string(),
        quantity: z.number().finite().optional().catch(undefined),
        unit: z.string().optional().catch(undefined),
    })
    // Branch count is the "no name → reject / no quantity → name-only / else pcs-default" coercion the spec requires.
    // fallow-ignore-next-line complexity
    .transform((raw, ctx) => {
        const name = raw.name.trim();

        if (!name) {
            ctx.addIssue({ code: 'custom', message: 'ingredient has no name' });

            return z.NEVER;
        }

        if (raw.quantity === undefined) {
            return { name };
        }

        const unit = raw.unit?.trim() || 'pcs';

        return { name, quantity: raw.quantity, unit };
    });

export const parsedRecipeSchema: z.ZodType<ParsedRecipe> = z
    .object({
        title: z.string().trim().catch(''),
        ingredients: z.array(ingredientSchema).min(1),
        instructions: stringArrayField(),
    })
    .transform((recipe): ParsedRecipe => ({
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
    }));
