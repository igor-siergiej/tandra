import { describe, expect, it } from 'bun:test';

import { type LlmRequest, llmReplying } from '../../testing/doubles';
import type { LlmResult } from '../FalLlmClient';
import { FalIngredientSubstituter } from './index';
import { substitutesSchema } from './schema';

type CompleteArgs = LlmRequest;

const fakeClient = llmReplying;

const result = <T>(value: T): LlmResult<T> => ({
    value,
    meta: { operation: 'ingredient.substitute', model: 'm', attempts: 1, latencyMs: 1 },
});

describe('FalIngredientSubstituter', () => {
    it('calls the client with operation ingredient.substitute, the substitutes schema and the ingredient name in the prompt', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ substitutes: ['margarine', 'coconut oil'] });
        });

        const substitutes = await new FalIngredientSubstituter(client).generateSubstitutes('butter');

        expect(seen?.operation).toBe('ingredient.substitute');
        expect(seen?.system).toContain('ingredient substitutes');
        expect(seen?.prompt).toBe('Ingredient: butter');
        expect(seen?.schema).toBe(substitutesSchema);
        expect(substitutes).toEqual(['margarine', 'coconut oil']);
    });

    it('includes the recipe title in the prompt when provided', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ substitutes: [] });
        });

        await new FalIngredientSubstituter(client).generateSubstitutes('butter', 'Carbonara');

        expect(seen?.prompt).toBe('Ingredient: butter\nRecipe: Carbonara');
    });

    it('propagates a client error unchanged', async () => {
        const client = fakeClient(async () => {
            throw Object.assign(new Error('fal.ai any-llm error: boom'), { status: 502 });
        });

        await expect(new FalIngredientSubstituter(client).generateSubstitutes('butter')).rejects.toMatchObject({
            status: 502,
        });
    });

    it('passes an explicit model and timeout through to the client', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ substitutes: [] });
        });

        await new FalIngredientSubstituter(client, { model: 'x/y', timeoutMs: 9000 }).generateSubstitutes('butter');

        expect(seen?.model).toBe('x/y');
        expect(seen?.timeoutMs).toBe(9000);
    });
});
