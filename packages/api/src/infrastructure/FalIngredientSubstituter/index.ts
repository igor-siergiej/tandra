import type { FalLlmClient } from '../FalLlmClient';
import { substitutesSchema } from './schema';

export interface FalIngredientSubstituterOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You suggest practical ingredient substitutes for home cooking. Given an ingredient ' +
    'name (and optionally the recipe it belongs to, for context), return 2-4 common, ' +
    'realistically available substitutes a home cook could use instead, roughly in order ' +
    'of how well they preserve the dish. Reply with ONLY a compact JSON object ' +
    '{"substitutes": string[]}. Each entry short (a few words at most), no duplicates, no ' +
    'explanations.';

export class FalIngredientSubstituter {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalIngredientSubstituterOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    // Invoked through the IngredientSubstituter interface via the DI container; fallow can't trace that indirection.
    // fallow-ignore-next-line unused-class-member
    async generateSubstitutes(ingredientName: string, recipeTitle?: string): Promise<string[]> {
        const { value } = await this.client.completeStructured({
            operation: 'ingredient.substitute',
            schema: substitutesSchema,
            system: SYSTEM_PROMPT,
            prompt: recipeTitle
                ? `Ingredient: ${ingredientName}\nRecipe: ${recipeTitle}`
                : `Ingredient: ${ingredientName}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value.substitutes;
    }
}
