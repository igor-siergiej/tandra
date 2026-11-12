import { afterEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import { z } from 'zod';

import { FalLlmClient } from './index';

const originalFetch = globalThis.fetch;

const stubFetch = (impl: typeof fetch) => {
    globalThis.fetch = impl as typeof fetch;
};

const okResponse = (output: string) =>
    new Response(JSON.stringify({ output }), { headers: { 'content-type': 'application/json' } });

const schema = z.object({ title: z.string(), count: z.number() });

const call = (client: FalLlmClient, overrides: Partial<Parameters<FalLlmClient['completeStructured']>[0]> = {}) =>
    client.completeStructured({
        operation: 'test.op',
        schema,
        system: 'SYS',
        prompt: 'PROMPT',
        ...overrides,
    });

describe('FalLlmClient', () => {
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('sends model, system prompt, temperature and Key auth, and returns the validated value', async () => {
        let url: string | undefined;
        let auth: string | null = null;
        let body: Record<string, unknown> = {};
        stubFetch(async (u, init) => {
            url = String(u);
            auth = new Headers(init?.headers).get('authorization');
            body = JSON.parse(init?.body as string);

            return okResponse('{"title":"Hi","count":3}');
        });

        const result = await call(new FalLlmClient('secret', undefined, { model: 'google/gemini-2.5-flash-lite' }));

        expect(url).toBe('https://fal.run/fal-ai/any-llm');
        expect(auth).toBe('Key secret');
        expect(body.model).toBe('google/gemini-2.5-flash-lite');
        expect(body.system_prompt).toBe('SYS');
        expect(body.prompt).toBe('PROMPT');
        expect(body.temperature).toBe(0);
        expect(result.value).toEqual({ title: 'Hi', count: 3 });
        expect(result.meta).toMatchObject({ operation: 'test.op', model: 'google/gemini-2.5-flash-lite', attempts: 1 });
        expect(typeof result.meta.latencyMs).toBe('number');
    });

    it('falls back to the default model when none is configured', async () => {
        let body: Record<string, unknown> = {};
        stubFetch(async (_u, init) => {
            body = JSON.parse(init?.body as string);

            return okResponse('{"title":"x","count":1}');
        });

        await call(new FalLlmClient('secret'));

        expect(body.model).toBe('google/gemini-2.5-flash-lite');
    });

    it('extracts a JSON object wrapped in prose or code fences', async () => {
        stubFetch(async () => okResponse('Sure:\n```json\n{"title":"x","count":1}\n```\nhope that helps'));

        const result = await call(new FalLlmClient('secret'));

        expect(result.value).toEqual({ title: 'x', count: 1 });
    });

    it('throws 500 when the api key is empty', async () => {
        stubFetch(async () => okResponse('{"title":"x","count":1}'));

        await expect(call(new FalLlmClient(''))).rejects.toMatchObject({
            status: 503,
            code: 'ai_disabled',
            message: expect.stringContaining('AI is disabled'),
        });
    });

    it('never calls the logger on the empty-key path', async () => {
        stubFetch(async () => okResponse('{"title":"x","count":1}'));
        const logs: unknown[][] = [];

        const logger = {
            info: (...a: unknown[]) => {
                logs.push(a);
            },
        } as unknown as Logger;

        await expect(call(new FalLlmClient('', logger))).rejects.toMatchObject({ status: 503, code: 'ai_disabled' });
        expect(logs).toHaveLength(0);
    });

    it('bounds the thrown message when a non-OK body is huge', async () => {
        stubFetch(async () => new Response('x'.repeat(5000), { status: 500 }));

        const error = await call(new FalLlmClient('secret')).catch((e: Error) => e);

        expect(error).toMatchObject({ status: 502 });
        expect((error as Error).message.length).toBeLessThan(260);
    });

    it('bounds the thrown message when the error field is huge', async () => {
        stubFetch(
            async () =>
                new Response(JSON.stringify({ error: 'y'.repeat(5000) }), {
                    headers: { 'content-type': 'application/json' },
                })
        );

        const error = await call(new FalLlmClient('secret')).catch((e: Error) => e);

        expect(error).toMatchObject({ status: 502 });
        expect((error as Error).message.length).toBeLessThan(260);
    });

    it('throws 502 on a non-OK response, without retrying', async () => {
        let calls = 0;
        stubFetch(async () => {
            calls += 1;

            return new Response('upstream boom', { status: 500 });
        });

        await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
        expect(calls).toBe(1);
    });

    it('throws 502 when the body reports an error field', async () => {
        stubFetch(
            async () =>
                new Response(JSON.stringify({ error: 'rate limited' }), {
                    headers: { 'content-type': 'application/json' },
                })
        );

        await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
    });

    it('throws 502 when a 200 response has a non-JSON body', async () => {
        stubFetch(async () => new Response('not json', { headers: { 'content-type': 'text/plain' } }));

        await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
    });

    it('throws 502 when fetch rejects (network / abort)', async () => {
        stubFetch(async () => {
            throw new DOMException('aborted', 'AbortError');
        });

        await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
    });

    it('applies the schema transform to the output', async () => {
        const trimSchema = z.object({ name: z.string().transform((s) => s.trim()) });
        stubFetch(async () => okResponse('{"name":"  spaced  "}'));

        const result = await new FalLlmClient('secret').completeStructured({
            operation: 'test.op',
            schema: trimSchema,
            system: 'SYS',
            prompt: 'PROMPT',
        });

        expect(result.value).toEqual({ name: 'spaced' });
    });

    it('retries once when the first reply has no JSON, then succeeds', async () => {
        const bodies: string[] = [];
        let n = 0;
        stubFetch(async (_u, init) => {
            bodies.push((JSON.parse(init?.body as string) as { prompt: string }).prompt);
            n += 1;

            return okResponse(n === 1 ? 'I could not do that' : '{"title":"x","count":1}');
        });

        const result = await call(new FalLlmClient('secret'));

        expect(result.value).toEqual({ title: 'x', count: 1 });
        expect(result.meta.attempts).toBe(2);
        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toContain('failed validation');
        expect(bodies[1]).toContain('no JSON object found');
    });

    it('retries when the reply is valid JSON but fails the schema, feeding back the zod issue', async () => {
        const bodies: string[] = [];
        let n = 0;
        stubFetch(async (_u, init) => {
            bodies.push((JSON.parse(init?.body as string) as { prompt: string }).prompt);
            n += 1;

            return okResponse(n === 1 ? '{"title":"x"}' : '{"title":"x","count":2}');
        });

        const result = await call(new FalLlmClient('secret'));

        expect(result.value).toEqual({ title: 'x', count: 2 });
        expect(bodies[1]).toContain('count');
    });

    it('throws 502 after maxAttempts invalid replies, message names the attempt count', async () => {
        let n = 0;
        stubFetch(async () => {
            n += 1;

            return okResponse('{"title":"x"}');
        });

        await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({
            status: 502,
            message: expect.stringContaining('failed validation after 2 attempts'),
        });
        expect(n).toBe(2);
    });

    it('honours an explicit maxAttempts', async () => {
        let n = 0;
        stubFetch(async () => {
            n += 1;

            return okResponse('nope');
        });

        await expect(call(new FalLlmClient('secret'), { maxAttempts: 3 })).rejects.toMatchObject({ status: 502 });
        expect(n).toBe(3);
    });

    it('does not retry a transport error', async () => {
        let n = 0;
        stubFetch(async () => {
            n += 1;

            return new Response('boom', { status: 503 });
        });

        await expect(call(new FalLlmClient('secret'))).rejects.toMatchObject({ status: 502 });
        expect(n).toBe(1);
    });

    it('aborts at timeoutMs and throws 502', async () => {
        stubFetch(
            ((_u, init) =>
                new Promise((_resolve, reject) => {
                    (init?.signal as AbortSignal | undefined)?.addEventListener('abort', () => {
                        reject(new DOMException('aborted', 'AbortError'));
                    });
                })) as typeof fetch
        );

        await expect(call(new FalLlmClient('secret'), { timeoutMs: 20 })).rejects.toMatchObject({ status: 502 });
    });

    it('logs exactly once per completeStructured call, with outcome ok', async () => {
        stubFetch((async () => okResponse('{"title":"x","count":1}')) as unknown as typeof fetch);
        const logs: unknown[][] = [];

        const logger = {
            info: (...a: unknown[]) => {
                logs.push(a);
            },
        } as unknown as Logger;

        await call(new FalLlmClient('secret', logger));

        expect(logs).toHaveLength(1);
        expect(logs[0]?.[1]).toMatchObject({ outcome: 'ok' });
    });
});
