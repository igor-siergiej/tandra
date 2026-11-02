import { parseIngredient } from 'parse-ingredient';

import type { IngredientStructurer, ParsedIngredient } from '../IngredientStructurer/types';

const PARENTHETICAL = /\([^)]*\)/g;
const STRAY_PAREN = /[()]/g;
const TRAILING_QUALIFIER = /,?\s*\b(?:to taste|as needed|optional|divided|plus more.*)\s*$/i;
const EDGE_PUNCTUATION = /^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g;

/**
 * Sites publish unit conversions and qualifiers inside the ingredient string itself
 * ("350 g spaghetti (- 12 oz)"). Names feed the AI image prompt, so strip them.
 */
const cleanName = (description: string): string =>
    description
        .replace(PARENTHETICAL, ' ')
        .replace(STRAY_PAREN, ' ')
        .replace(TRAILING_QUALIFIER, '')
        .replace(/\s+/g, ' ')
        .replace(EDGE_PUNCTUATION, '')
        .trim();

export class RuleIngredientStructurer implements IngredientStructurer {
    readonly strategy = 'rule' as const;

    async structure(lines: string[]): Promise<ParsedIngredient[]> {
        return lines.map((line) => this.structureLine(line));
    }

    // Parse first, strip second: "1 (14 oz) can diced tomatoes" must keep its quantity of 1.
    private structureLine(line: string): ParsedIngredient {
        const [parsed] = parseIngredient(line);
        const name = cleanName(parsed?.description ?? '') || line;
        const quantity = parsed?.quantity;

        if (quantity === undefined || quantity === null) return { name };

        return { name, quantity, unit: parsed?.unitOfMeasure || 'pcs' };
    }
}
