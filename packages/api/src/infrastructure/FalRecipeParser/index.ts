import type { ParsedRecipe, RecipeParser } from '../../domain/RecipeImportService/types';
import type { FalLlmClient } from '../FalLlmClient';
import { parsedRecipeSchema } from './schema';

export interface FalRecipeParserOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You extract a single recipe from a JSON-LD document or the plain text of a web page. Reply with ONLY a compact ' +
    'JSON object of the shape {"title": string, "ingredients": [{"name": string, "quantity"?: number, "unit"?: ' +
    'string}], "instructions": [string]}. "name" is the bare ingredient: no measurements, no parenthetical text, and ' +
    'no qualifiers such as "to taste", "optional" or "divided". Include "quantity" and "unit" only when the source ' +
    'states a measurement; use "pcs" as the unit for a bare count. Each instruction is one step. Do not invent ' +
    'content that is not present. Output no prose, no markdown, no code fences.';

const bad = (message: string): Error => Object.assign(new Error(message), { status: 502 });

export class FalRecipeParser implements RecipeParser {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalRecipeParserOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    async parse(source: string): Promise<ParsedRecipe> {
        if (!source.trim()) {
            throw bad('No recipe source to parse');
        }

        const { value } = await this.client.completeStructured({
            operation: 'recipe.parse',
            schema: parsedRecipeSchema,
            system: SYSTEM_PROMPT,
            prompt: `Extract the recipe from this source:\n\n${source}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value;
    }
}
