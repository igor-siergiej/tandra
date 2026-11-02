import { describe, expect, it, mock } from 'bun:test';

import type { FalLlmClient, LlmResult } from '../FalLlmClient';
import { FalRecipeTagger } from './index';
import { taggedRecipeSchema } from './schema';

type CompleteArgs = Parameters<FalLlmClient['completeStructured']>[0];

const fakeClient = (impl: (args: CompleteArgs) => Promise<LlmResult<unknown>>) =>
    ({ completeStructured: mock(impl) }) as unknown as FalLlmClient;

const result = <T>(value: T): LlmResult<T> => ({
    value,
    meta: { operation: 'recipe.tag', model: 'm', attempts: 1, latencyMs: 1 },
});

describe('FalRecipeTagger', () => {
    it('calls the client with operation recipe.tag, the tagged-recipe schema and title/ingredients/instructions in the prompt', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ tags: ['pasta', 'egg', 'pork'] });
        });

        const tags = await new FalRecipeTagger(client).generateTags(
            'Carbonara',
            [
                { id: '1', name: 'egg' },
                { id: '2', name: 'pancetta' },
            ],
            ['Boil pasta.']
        );

        expect(seen?.operation).toBe('recipe.tag');
        expect(seen?.system).toContain('core defining tags');
        expect(seen?.prompt).toContain('Carbonara');
        expect(seen?.prompt).toContain('egg, pancetta');
        expect(seen?.prompt).toContain('Boil pasta.');
        expect(seen?.schema).toBe(taggedRecipeSchema);
        expect(tags).toEqual(['pasta', 'egg', 'pork']);
    });

    it('defaults instructions to empty when omitted', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ tags: [] });
        });

        await new FalRecipeTagger(client).generateTags('Toast', [{ id: '1', name: 'bread' }]);

        expect(seen?.prompt.endsWith('Instructions: ')).toBe(true);
    });

    it('propagates a client error unchanged', async () => {
        const client = fakeClient(async () => {
            throw Object.assign(new Error('fal.ai any-llm error: boom'), { status: 502 });
        });

        await expect(new FalRecipeTagger(client).generateTags('Soup', [])).rejects.toMatchObject({ status: 502 });
    });

    it('passes an explicit model and timeout through to the client', async () => {
        let seen: CompleteArgs | undefined;

        const client = fakeClient(async (args) => {
            seen = args;

            return result({ tags: [] });
        });

        await new FalRecipeTagger(client, { model: 'x/y', timeoutMs: 9000 }).generateTags('Soup', []);

        expect(seen?.model).toBe('x/y');
        expect(seen?.timeoutMs).toBe(9000);
    });
});
