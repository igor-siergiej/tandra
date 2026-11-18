import { afterEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import { z } from 'zod';

import { substitutesSchema } from '../FalIngredientSubstituter/schema';
import { categorySchema } from '../FalItemCategoriser/schema';
import { spokenItemsSchema } from '../FalItemTextParser/schema';
import { recipeEstimateSchema } from '../FalRecipeEstimator/schema';
import { extractedRecipeSchema } from '../FalRecipeExtractor/schema';
import { parsedRecipeSchema } from '../FalRecipeParser/schema';
import { taggedRecipeSchema } from '../FalRecipeTagger/schema';
import { FalLlmClient } from './index';

/**
 * Provider decision for tandra #76: the direct Gemini API (`generateContent`, `gemini-3.5-flash-lite`,
 * native JSON-schema output built from the Zod schemas), not fal `any-llm` and not OpenRouter.
 * One GEMINI_API_KEY also covers image input (#77) and embeddings (#78).
 */

const originalFetch = globalThis.fetch;

const stubFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
    globalThis.fetch = ((u: string | URL | Request, init?: RequestInit) => impl(String(u), init)) as typeof fetch;
};

const geminiReply = (text: string) =>
    new Response(
        JSON.stringify({
            candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
        }),
        { headers: { 'content-type': 'application/json' } }
    );

interface JsonSchema {
    type?: string;
    properties: Record<string, JsonSchema>;
    required: string[];
    enum?: string[];
}

interface RequestBody {
    systemInstruction?: { parts?: { text?: string }[] };
    contents?: { role?: string; parts?: { text?: string }[] }[];
    generationConfig?: {
        responseMimeType?: string;
        responseJsonSchema?: JsonSchema;
        responseSchema?: JsonSchema;
        temperature?: number;
    };
    temperature?: number;
}

interface Captured {
    url: string;
    headers: Headers;
    body: RequestBody;
}

const capture = (reply: () => Response = () => geminiReply('{"title":"Hi","count":3}')) => {
    const requests: Captured[] = [];

    stubFetch(async (url, init) => {
        requests.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) });

        return reply();
    });

    return requests;
};

/** The JSON schema the request constrains decoding with (`responseJsonSchema` or the older `responseSchema`). */
const requestedSchema = (body: RequestBody): JsonSchema => {
    const sent = body.generationConfig?.responseJsonSchema ?? body.generationConfig?.responseSchema;

    if (!sent) throw new Error('request carries no JSON schema in generationConfig');

    return sent;
};

const GEMINI_HOST = 'generativelanguage.googleapis.com';

const schema = z.object({ title: z.string(), count: z.number() });

const call = (client: FalLlmClient, overrides: Partial<Parameters<FalLlmClient['completeStructured']>[0]> = {}) =>
    client.completeStructured({ operation: 'test.op', schema, system: 'SYS', prompt: 'PROMPT', ...overrides });

describe('LLM client: Gemini native structured output', () => {
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('provider and model', () => {
        it('calls the Gemini generateContent endpoint with the default gemini-3.5-flash-lite model', async () => {
            const requests = capture();

            const result = await call(new FalLlmClient('secret'));

            expect(requests).toHaveLength(1);
            expect(requests[0]?.url).toStartWith('https://generativelanguage.googleapis.com/');
            expect(new URL(requests[0]?.url ?? '').pathname).toEndWith('/models/gemini-3.5-flash-lite:generateContent');
            expect(result.meta.model).toBe('gemini-3.5-flash-lite');
        });

        it('uses the configured model (the RECIPE_IMPORT_LLM_MODEL override) instead of the default', async () => {
            const requests = capture();

            const result = await call(new FalLlmClient('secret', undefined, { model: 'gemini-3.8-flash' }));

            expect(new URL(requests[0]?.url ?? '').pathname).toEndWith('/models/gemini-3.8-flash:generateContent');
            expect(result.meta.model).toBe('gemini-3.8-flash');
        });

        it('lets a per-call model beat the configured one', async () => {
            const requests = capture();

            await call(new FalLlmClient('secret', undefined, { model: 'gemini-3.8-flash' }), {
                model: 'gemini-3.5-flash-lite',
            });

            expect(new URL(requests[0]?.url ?? '').pathname).toEndWith('/models/gemini-3.5-flash-lite:generateContent');
        });

        it('never targets the deprecated fal any-llm endpoint or a 2.5 model by default', async () => {
            const requests = capture();

            await call(new FalLlmClient('secret'));

            expect(requests[0]?.url).not.toContain('fal.run');
            expect(requests[0]?.url).not.toContain('gemini-2.5');
        });

        it('authenticates with the key in the x-goog-api-key header, not in the URL', async () => {
            const requests = capture();

            await call(new FalLlmClient('secret-key-123'));

            expect(requests[0]?.headers.get('x-goog-api-key')).toBe('secret-key-123');
            expect(requests[0]?.url).not.toContain('secret-key-123');
        });

        it('sends the system prompt as systemInstruction and the prompt as the user turn', async () => {
            const requests = capture();

            await call(new FalLlmClient('secret'));

            const body = requests[0]?.body ?? {};
            expect(body.systemInstruction?.parts?.[0]?.text).toBe('SYS');
            expect(body.contents?.[0]?.parts?.[0]?.text).toBe('PROMPT');
            expect(body.contents?.[0]?.role ?? 'user').toBe('user');
        });

        it('stops sending temperature (Gemini deprecated it)', async () => {
            const requests = capture();

            await call(new FalLlmClient('secret'));

            const body = requests[0]?.body ?? {};
            expect(body).not.toHaveProperty('temperature');
            expect(body.generationConfig ?? {}).not.toHaveProperty('temperature');
        });
    });

    describe('native JSON-schema mode generated from the Zod schema', () => {
        it('asks for application/json constrained by a JSON schema built from the Zod schema', async () => {
            const requests = capture();

            await call(new FalLlmClient('secret'));

            const body = requests[0]?.body ?? {};
            expect(body.generationConfig?.responseMimeType).toBe('application/json');

            const sent = requestedSchema(body);
            expect(String(sent.type).toLowerCase()).toBe('object');
            expect(Object.keys(sent.properties).sort()).toEqual(['count', 'title']);
            expect(String(sent.properties.title.type).toLowerCase()).toBe('string');
            expect(['number', 'integer']).toContain(String(sent.properties.count.type).toLowerCase());
            expect([...sent.required].sort()).toEqual(['count', 'title']);
        });

        it('follows the Zod schema: enums, optional fields and arrays reach the provider', async () => {
            const requests = capture(() => geminiReply('{"label":"a","tags":["x"]}'));

            const rich = z.object({
                label: z.enum(['a', 'b']),
                tags: z.array(z.string()),
                note: z.string().optional(),
            });

            await call(new FalLlmClient('secret'), { schema: rich });

            const sent = requestedSchema(requests[0]?.body ?? {});
            expect(sent.properties.label.enum).toEqual(['a', 'b']);
            expect(String(sent.properties.tags.type).toLowerCase()).toBe('array');
            expect([...sent.required].sort()).toEqual(['label', 'tags']);
        });

        it('sends no schema that differs between two schemas: each call carries its own', async () => {
            const requests = capture(() => geminiReply('{"other":"x"}'));

            await call(new FalLlmClient('secret'));
            await call(new FalLlmClient('secret'), { schema: z.object({ other: z.string() }) });

            expect(Object.keys(requestedSchema(requests[0]?.body ?? {}).properties).sort()).toEqual(['count', 'title']);
            expect(Object.keys(requestedSchema(requests[1]?.body ?? {}).properties)).toEqual(['other']);
        });

        it('still applies the schema .transform() to the provider reply', async () => {
            const requests = capture(() => geminiReply('{"title":"  padded  "}'));

            const trim = z.object({ title: z.string() }).transform((v) => ({ title: v.title.trim() }));

            const result = await call(new FalLlmClient('secret'), { schema: trim });

            expect(result.value).toEqual({ title: 'padded' });
            expect(requestedSchema(requests[0]?.body ?? {}).properties.title).toBeDefined();
        });

        const cases: [string, z.ZodType, string[]][] = [
            ['recipe.extract', extractedRecipeSchema, ['title', 'ingredients', 'instructions']],
            ['recipe.parse', parsedRecipeSchema, ['title', 'ingredients', 'instructions']],
            ['recipe.tag', taggedRecipeSchema, ['tags']],
            ['ingredient.substitute', substitutesSchema, ['substitutes']],
            ['recipe.estimate', recipeEstimateSchema, ['prepTime', 'cookTime', 'servings', 'difficulty']],
            ['item.categorise', categorySchema, ['category']],
            ['item.parse-speech', spokenItemsSchema, ['items']],
        ];

        for (const [operation, realSchema, properties] of cases) {
            it(`builds an object JSON schema from the real ${operation} schema (transforms, catch, preprocess)`, async () => {
                const requests = capture(() => geminiReply('{}'));

                // The reply may or may not satisfy the schema; only the request matters here.
                await call(new FalLlmClient('secret'), { operation, schema: realSchema }).catch(() => undefined);

                expect(requests).toHaveLength(1);

                const sent = requestedSchema(requests[0]?.body ?? {});
                expect(String(sent?.type).toLowerCase()).toBe('object');
                expect(Object.keys(sent.properties).sort()).toEqual([...properties].sort());
            });
        }

        it('constrains the estimate difficulty to the enum the Zod schema allows', async () => {
            const requests = capture(() => geminiReply('{"difficulty":"easy"}'));

            const result = await call(new FalLlmClient('secret'), { schema: recipeEstimateSchema });

            expect(requestedSchema(requests[0]?.body ?? {}).properties.difficulty.enum).toEqual([
                'easy',
                'medium',
                'hard',
            ]);
            expect(result.value).toEqual({ difficulty: 'easy' });
        });

        it('constrains the item category to the shared ITEM_CATEGORIES enum', async () => {
            const requests = capture(() => geminiReply('{"category":"bakery"}'));

            const result = await call(new FalLlmClient('secret'), { schema: categorySchema });

            const sent = requestedSchema(requests[0]?.body ?? {});
            expect(sent.properties.category.enum).toContain('bakery');
            expect(result.value).toEqual({ category: 'bakery' });
        });
    });

    describe('reply handling without brace slicing or validation retries', () => {
        it('returns the validated value and reports a single attempt', async () => {
            capture(() => geminiReply('{"title":"Hi","count":3}'));

            const result = await call(new FalLlmClient('secret'));

            expect(result.value).toEqual({ title: 'Hi', count: 3 });
            expect(result.meta).toMatchObject({ operation: 'test.op', attempts: 1 });
            expect(typeof result.meta.latencyMs).toBe('number');
        });

        it('does not slice a JSON object out of prose: a reply with surrounding text is a 502', async () => {
            const requests = capture(() => geminiReply('Sure! Here it is: {"title":"x","count":1} Enjoy.'));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
        });

        it('does not slice a JSON object out of a code fence', async () => {
            const requests = capture(() => geminiReply('```json\n{"title":"x","count":1}\n```'));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
            expect(requests[0]?.url).toContain(GEMINI_HOST);
        });

        it('does not re-prompt when the reply is not JSON: one paid call, then 502', async () => {
            const requests = capture(() => geminiReply('not json at all'));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
        });

        it('does not re-prompt when the JSON fails the schema: one paid call, then 502', async () => {
            const requests = capture(() => geminiReply('{"title":"x","count":"many"}'));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
        });

        it('never feeds validation issues back into a second prompt, even when asked for more attempts', async () => {
            const requests = capture(() => geminiReply('{"title":"x","count":"many"}'));

            await call(new FalLlmClient('secret'), { maxAttempts: 3 } as never).catch(() => undefined);

            expect(requests).toHaveLength(1);
        });

        it('throws 502 when the reply has no candidates (e.g. blocked by safety filters)', async () => {
            const requests = capture(() => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
            expect(requests[0]?.url).toContain(GEMINI_HOST);
        });

        it('throws 502 when the candidate carries no text', async () => {
            const requests = capture(() => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
            expect(requests[0]?.url).toContain(GEMINI_HOST);
        });
    });

    describe('errors and plumbing', () => {
        it('names GEMINI_API_KEY, not FAL_KEY, in the disabled message', async () => {
            const requests = capture();

            await expect(call(new FalLlmClient(''))).rejects.toMatchObject({
                status: 503,
                code: 'ai_disabled',
                message: expect.stringContaining('GEMINI_API_KEY'),
            });
            expect(requests).toHaveLength(0);
        });

        it('throws 502 on a non-OK response without retrying, bounding the message', async () => {
            const requests = capture(() => new Response('x'.repeat(5000), { status: 429 }));

            const error = await call(new FalLlmClient('secret')).catch((e: Error) => e);

            expect(error).toMatchObject({ status: 502 });
            expect((error as Error).message.length).toBeLessThan(260);
            expect(requests).toHaveLength(1);
            expect(requests[0]?.url).toContain(GEMINI_HOST);
        });

        it('throws 502 when a 200 response has a non-JSON body', async () => {
            const requests = capture(() => new Response('<html>gateway</html>', { status: 200 }));

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(requests).toHaveLength(1);
            expect(requests[0]?.url).toContain(GEMINI_HOST);
        });

        it('throws 502 when fetch rejects, without retrying', async () => {
            const urls: string[] = [];

            stubFetch(async (url) => {
                urls.push(url);
                throw new TypeError('network down');
            });

            await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
            expect(urls).toHaveLength(1);
            expect(urls[0]).toContain(GEMINI_HOST);
        });

        it('aborts at timeoutMs and throws 502', async () => {
            const urls: string[] = [];

            stubFetch((url, init) => {
                urls.push(url);

                const { promise, reject } = Promise.withResolvers<Response>();

                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('aborted', 'AbortError'));
                });

                return promise;
            });

            await expect(call(new FalLlmClient('secret'), { timeoutMs: 20 })).rejects.toMatchObject({ status: 502 });
            expect(urls).toHaveLength(1);
            expect(urls[0]).toContain(GEMINI_HOST);
        });

        it('logs exactly once per call with outcome ok and the Gemini model name', async () => {
            capture();
            const logs: unknown[][] = [];

            const logger = {
                info: (...a: unknown[]) => {
                    logs.push(a);
                },
            } as unknown as Logger;

            await call(new FalLlmClient('secret', logger));

            expect(logs).toHaveLength(1);
            expect(logs[0]?.[1]).toMatchObject({ outcome: 'ok', model: 'gemini-3.5-flash-lite', attempts: 1 });
        });

        it('logs outcome invalid once, after a single Gemini call, when the reply is not valid for the schema', async () => {
            const requests = capture(() => geminiReply('{"title":1}'));
            const logs: unknown[][] = [];

            const logger = {
                info: (...a: unknown[]) => {
                    logs.push(a);
                },
            } as unknown as Logger;

            await call(new FalLlmClient('secret', logger)).catch(() => undefined);

            expect(requests).toHaveLength(1);
            expect(logs).toHaveLength(1);
            expect(logs[0]?.[1]).toMatchObject({ outcome: 'invalid', model: 'gemini-3.5-flash-lite' });
        });
    });
});
