import { describe, expect, it } from 'bun:test';

import { type LlmRequest, llmReplying } from '../../testing/doubles';
import type { LlmResult } from '../FalLlmClient';
import { FalRecipeExtractor } from './index';
import { extractedRecipeSchema } from './schema';

type CompleteArgs = LlmRequest;

const fakeClient = llmReplying;

const result = <T>(value: T): LlmResult<T> => ({
    value,
    meta: { operation: 'recipe.extract', model: 'm', attempts: 1, latencyMs: 1 },
});

describe('FalRecipeExtractor', () => {
    it('calls the client with operation recipe.extract, the extracted-recipe schema and the page text in the prompt', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ title: 'Soup', ingredients: ['1 onion'], instructions: ['Boil.'] });
        });

        const extracted = await new FalRecipeExtractor(client).extract('page text here');

        expect(seen?.operation).toBe('recipe.extract');
        expect(seen?.system).toContain('extract a single recipe');
        expect(seen?.prompt).toContain('page text here');
        expect(seen?.schema).toBe(extractedRecipeSchema);
        expect(extracted).toEqual({ title: 'Soup', ingredients: ['1 onion'], instructions: ['Boil.'] });
    });

    it('propagates a client error unchanged', async () => {
        const client = fakeClient(async () => {
            throw Object.assign(new Error('fal.ai any-llm error: boom'), { status: 502 });
        });

        await expect(new FalRecipeExtractor(client).extract('text')).rejects.toMatchObject({ status: 502 });
    });

    it('passes an explicit model and timeout through to the client', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ title: '', ingredients: [], instructions: [] });
        });

        await new FalRecipeExtractor(client, { model: 'x/y', timeoutMs: 9000 }).extract('text');

        expect(seen?.model).toBe('x/y');
        expect(seen?.timeoutMs).toBe(9000);
    });
});
