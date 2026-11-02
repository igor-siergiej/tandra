import { describe, expect, it, mock } from 'bun:test';

import type { FalLlmClient, LlmResult } from '../FalLlmClient';
import { FalRecipeParser } from './index';
import { parsedRecipeSchema } from './schema';

type CompleteArgs = Parameters<FalLlmClient['completeStructured']>[0];

const fakeClient = (impl: (args: CompleteArgs) => Promise<LlmResult<unknown>>) =>
    ({ completeStructured: mock(impl) }) as unknown as FalLlmClient;

const result = <T>(value: T): LlmResult<T> => ({
    value,
    meta: { operation: 'recipe.parse', model: 'm', attempts: 1, latencyMs: 1 },
});

describe('FalRecipeParser', () => {
    it('throws 502 when the source is empty, without calling the client', async () => {
        const complete = mock(async () => result({}));
        const parser = new FalRecipeParser({ completeStructured: complete } as unknown as FalLlmClient);

        await expect(parser.parse('   ')).rejects.toMatchObject({ status: 502 });
        expect(complete).not.toHaveBeenCalled();
    });

    it('calls the client with operation recipe.parse, the parsed-recipe schema and the source in the prompt', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({
                title: 'Carbonara',
                ingredients: [{ name: 'spaghetti', quantity: 350, unit: 'g' }],
                instructions: ['Boil.'],
            });
        });

        const parsed = await new FalRecipeParser(client).parse('{"@type":"Recipe"}');

        expect(seen?.operation).toBe('recipe.parse');
        expect(seen?.system).toContain('extract a single recipe');
        expect(seen?.prompt).toContain('{"@type":"Recipe"}');
        expect(seen?.schema).toBe(parsedRecipeSchema);
        expect(parsed).toEqual({
            title: 'Carbonara',
            ingredients: [{ name: 'spaghetti', quantity: 350, unit: 'g' }],
            instructions: ['Boil.'],
        });
    });

    it('propagates a client error unchanged', async () => {
        const client = fakeClient(async () => {
            throw Object.assign(new Error('fal.ai any-llm error: rate limited'), { status: 502 });
        });

        await expect(new FalRecipeParser(client).parse('src')).rejects.toMatchObject({ status: 502 });
    });

    it('passes an explicit model and timeout through to the client', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ title: 'X', ingredients: [{ name: 'salt' }], instructions: [] });
        });

        await new FalRecipeParser(client, { model: 'anthropic/claude-3-haiku', timeoutMs: 8000 }).parse('src');

        expect(seen?.model).toBe('anthropic/claude-3-haiku');
        expect(seen?.timeoutMs).toBe(8000);
    });
});
