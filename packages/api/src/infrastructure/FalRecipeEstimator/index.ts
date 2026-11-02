import type { DiscoveryEstimatedField, Ingredient } from '@tandra/types';

import type { RecipeEstimate, RecipeEstimator } from '../../domain/WikibooksIngest/types';
import type { FalLlmClient } from '../FalLlmClient';
import { recipeEstimateSchema } from './schema';

export interface FalRecipeEstimatorOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You estimate missing facts about a recipe from its title, ingredients and steps. Reply with ONLY a compact JSON ' +
    'object containing exactly the requested fields: "prepTime" (hands-on preparation, whole minutes), "cookTime" ' +
    '(cooking/baking/chilling time, whole minutes; 0 is not allowed, omit the field if the dish is not cooked), ' +
    '"servings" (whole number of portions), "difficulty" (one of "easy", "medium", "hard"). Be realistic and ' +
    'conservative. Output no prose, no markdown, no code fences.';

export class FalRecipeEstimator implements RecipeEstimator {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalRecipeEstimatorOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    async estimate(
        recipe: { title: string; ingredients: Ingredient[]; instructions: string[] },
        fields: DiscoveryEstimatedField[]
    ): Promise<RecipeEstimate> {
        const { value } = await this.client.completeStructured({
            operation: 'recipe.estimate',
            schema: recipeEstimateSchema,
            system: SYSTEM_PROMPT,
            prompt:
                `Requested fields: ${fields.join(', ')}\n` +
                `Title: ${recipe.title}\n` +
                `Ingredients: ${recipe.ingredients.map((i) => i.name).join(', ')}\n` +
                `Steps: ${recipe.instructions.join(' ').slice(0, 3000)}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value;
    }
}
