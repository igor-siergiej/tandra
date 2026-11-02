import type { FalLlmClient } from '../FalLlmClient';
import { type ParsedShoppingItem, spokenItemsSchema } from './schema';

export interface FalItemTextParserOptions {
    model?: string;
    timeoutMs?: number;
}

const SYSTEM_PROMPT =
    'You turn a spoken shopping request into separate shopping list items. Split the text into one entry per ' +
    'distinct product. For each, return a short singular-or-plural product name without quantities ("bread", ' +
    '"eggs"), an optional numeric quantity ("two loaves" -> 2, "a dozen" -> 12, "a" or "an" -> 1) and an optional ' +
    'short unit ("loaf", "kg", "g", "l", "ml", "pack", "can"). Omit quantity and unit when not stated. Ignore filler ' +
    'words and anything that is not a product. Reply with ONLY a compact JSON object ' +
    '{"items": [{"name": string, "quantity"?: number, "unit"?: string}]}.';

export class FalItemTextParser {
    private readonly model?: string;
    private readonly timeoutMs?: number;

    constructor(
        private readonly client: FalLlmClient,
        options: FalItemTextParserOptions = {}
    ) {
        this.model = options.model;
        this.timeoutMs = options.timeoutMs;
    }

    // Invoked through the DI container; fallow can't trace that indirection.
    // fallow-ignore-next-line unused-class-member
    async parse(transcript: string): Promise<ParsedShoppingItem[]> {
        const { value } = await this.client.completeStructured({
            operation: 'item.parse-speech',
            schema: spokenItemsSchema,
            system: SYSTEM_PROMPT,
            prompt: `Request: ${transcript}`,
            ...(this.model !== undefined && { model: this.model }),
            ...(this.timeoutMs !== undefined && { timeoutMs: this.timeoutMs }),
        });

        return value.items;
    }
}
