import { describe, expect, it } from 'bun:test';

import { aiFeaturesFromEnv } from './index';

describe('aiFeaturesFromEnv with the Gemini key', () => {
    it('turns every text-AI feature on when only GEMINI_API_KEY is set, and leaves image generation (fal) off', () => {
        expect(aiFeaturesFromEnv({ GEMINI_API_KEY: 'demo-gemini-key' } as NodeJS.ProcessEnv)).toEqual({
            imageGeneration: false,
            recipeImport: true,
            ingredientSubstitutes: true,
            itemCategorisation: true,
            itemParse: true,
            recipeTagger: true,
        });
    });
});
