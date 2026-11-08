import { ITEM_CATEGORIES, type ItemCategory } from '@tandra/types';

import type { FalLlmClient } from '../FalLlmClient';
import { categorySchema } from './schema';

export interface FalItemCategoriserOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You sort supermarket shopping list items into the aisle where a shopper finds them. ' +
    `Allowed categories: ${ITEM_CATEGORIES.join(', ')}. Use "meat-fish" for meat, poultry and fish, ` +
    '"pantry" for dry goods, tins, sauces, spices, oils and baking ingredients, "household" for non-food items, ' +
    '"other" only when nothing fits. Reply with ONLY a compact JSON object {"category": string}.';

export class FalItemCategoriser {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalItemCategoriserOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    // Invoked through the ItemClassifier interface via the DI container; fallow can't trace that indirection.
    // fallow-ignore-next-line unused-class-member
    async classify(name: string): Promise<ItemCategory> {
        const { value } = await this.client.completeStructured({
            operation: 'item.categorise',
            schema: categorySchema,
            system: SYSTEM_PROMPT,
            prompt: `Item: ${name}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value.category;
    }
}
