import type { RecipeTextExtractor } from '../../domain/RecipeImportService/types';
import type { FalLlmClient } from '../FalLlmClient';
import { extractedRecipeSchema } from './schema';

export interface FalRecipeExtractorOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You extract a single recipe from the plain text of a web page. Reply with ONLY a compact JSON object of the ' +
    'shape {"title": string, "ingredients": string[], "instructions": string[]}. Each ingredient is one full line ' +
    '(quantity, unit and item together). Each instruction is one step. Do not invent content that is not present. ' +
    'If a field is unknown use an empty string or empty array. Output no prose, no markdown, no code fences.';

interface ExtractedRecipe {
    title: string;
    ingredients: string[];
    instructions: string[];
}

export class FalRecipeExtractor implements RecipeTextExtractor {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalRecipeExtractorOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    async extract(text: string): Promise<ExtractedRecipe> {
        const { value } = await this.client.completeStructured({
            operation: 'recipe.extract',
            schema: extractedRecipeSchema,
            system: SYSTEM_PROMPT,
            prompt: `Extract the recipe from this page text:\n\n${text}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value;
    }
}
