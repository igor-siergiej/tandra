import type { Ingredient } from '@tandra/types';

import type { FalLlmClient } from '../FalLlmClient';
import { taggedRecipeSchema } from './schema';

export interface FalRecipeTaggerOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You extract the core defining tags of a recipe/dish, for search by craving rather than ' +
    'by name. Given a title, ingredient list and instructions, return the 4-8 tags a person ' +
    'would use to find this dish even if they forgot its name (protein, cuisine, dish type, ' +
    'key ingredient, texture/style — e.g. carbonara: pasta, egg, cheese, pork, creamy). Reply ' +
    'with ONLY a compact JSON object {"tags": string[]}. Lowercase, single words or short ' +
    'phrases, no duplicates, no punctuation.';

export class FalRecipeTagger {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalRecipeTaggerOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    // Invoked through the RecipeTagger interface via the DI container; fallow can't trace that indirection.
    // fallow-ignore-next-line unused-class-member
    async generateTags(title: string, ingredients: Ingredient[], instructions?: string[]): Promise<string[]> {
        const { value } = await this.client.completeStructured({
            operation: 'recipe.tag',
            schema: taggedRecipeSchema,
            system: SYSTEM_PROMPT,
            prompt:
                `Title: ${title}\n` +
                `Ingredients: ${ingredients.map((i) => i.name).join(', ')}\n` +
                `Instructions: ${(instructions ?? []).join(' ')}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value.tags;
    }
}
