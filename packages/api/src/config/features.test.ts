import { describe, expect, it } from 'bun:test';

import { aiFeaturesFromEnv, authFeaturesFromEnv } from './index';

describe('aiFeaturesFromEnv', () => {
    it('reports every feature as off when FAL_KEY and the LLM key are both empty', () => {
        expect(aiFeaturesFromEnv({})).toEqual({
            imageGeneration: false,
            recipeImport: false,
            ingredientSubstitutes: false,
            itemCategorisation: false,
            itemParse: false,
            recipeTagger: false,
        });
    });

    it('flips image generation on when FAL_KEY is set', () => {
        const features = aiFeaturesFromEnv({ FAL_KEY: 'demo-key' });
        expect(features.imageGeneration).toBe(true);
        expect(features.recipeImport).toBe(true);
        expect(features.ingredientSubstitutes).toBe(true);
    });

    it('flips the LLM features on when only RECIPE_IMPORT_LLM_API_KEY is set', () => {
        const features = aiFeaturesFromEnv({ RECIPE_IMPORT_LLM_API_KEY: 'demo-llm-key' });
        expect(features.imageGeneration).toBe(false);
        expect(features.recipeImport).toBe(true);
        expect(features.ingredientSubstitutes).toBe(true);
        expect(features.recipeTagger).toBe(true);
    });
});

describe('authFeaturesFromEnv', () => {
    it('reports Google as off when neither Google client var is set', () => {
        expect(authFeaturesFromEnv({})).toEqual({ googleSignIn: false });
    });

    it('reports Google as off when only one of the two Google vars is set', () => {
        expect(authFeaturesFromEnv({ GOOGLE_CLIENT_ID: 'id' })).toEqual({
            googleSignIn: false,
        });
        expect(authFeaturesFromEnv({ GOOGLE_CLIENT_SECRET: 'secret' })).toEqual({
            googleSignIn: false,
        });
    });

    it('reports Google as on only when both Google vars are set', () => {
        expect(
            authFeaturesFromEnv({
                GOOGLE_CLIENT_ID: 'id',
                GOOGLE_CLIENT_SECRET: 'secret',
            })
        ).toEqual({ googleSignIn: true });
    });
});
