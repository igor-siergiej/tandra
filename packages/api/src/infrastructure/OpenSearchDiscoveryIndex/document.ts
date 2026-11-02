import type { DiscoveryRecipe, DiscoveryRecipeSummary } from '@tandra/types';
import { z } from 'zod';

/** The searchable subset of a library recipe. Instructions and quantities stay in Mongo only. */
// One flat field-by-field projection.
// fallow-ignore-next-line complexity
export const toIndexDocument = (recipe: DiscoveryRecipe) => {
    const hasTime = recipe.prepTime !== undefined || recipe.cookTime !== undefined;

    return {
        id: recipe.id,
        title: recipe.title,
        ingredientNames: recipe.ingredients.map((i) => i.name),
        tags: recipe.tags,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: hasTime ? (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0) : undefined,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        source: recipe.source,
        estimated: recipe.estimated,
        coverImageKey: recipe.coverImageKey,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
    };
};

export const SUMMARY_FIELDS = [
    'id',
    'title',
    'tags',
    'prepTime',
    'cookTime',
    'servings',
    'difficulty',
    'coverImageKey',
    'source',
    'estimated',
] as const satisfies ReadonlyArray<keyof DiscoveryRecipeSummary>;

export const summarySchema: z.ZodType<DiscoveryRecipeSummary> = z.object({
    id: z.string(),
    title: z.string(),
    tags: z.array(z.string()),
    prepTime: z.number().optional(),
    cookTime: z.number().optional(),
    servings: z.number().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    coverImageKey: z.string().optional(),
    source: z.enum(['wikibooks', 'user']),
    estimated: z.array(z.enum(['prepTime', 'cookTime', 'servings', 'difficulty'])).optional(),
});
