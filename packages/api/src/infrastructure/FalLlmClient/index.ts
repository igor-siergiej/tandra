import type { Logger } from '@imapps/api-utils';
import { type ZodError, type ZodType, z } from 'zod';

import { caughtErrorSchema } from '../caughtError';

const FAL_ANY_LLM_URL = 'https://fal.run/fal-ai/any-llm';
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ATTEMPTS = 2;

const replySchema = z
    .looseObject({
        output: z.string().optional().catch(undefined),
        error: z.unknown().optional(),
    })
    .catch({});

const fail = (message: string): Error => Object.assign(new Error(message), { status: 502 });

export interface CompleteStructuredOptions<T> {
    /** Identifies the call in logs, e.g. 'recipe.parse'. */
    operation: string;
    /** Output is parsed against this. `.transform()` is honoured. */
    schema: ZodType<T>;
    system: string;
    prompt: string;
    /** Falls back to the client's configured model, then DEFAULT_MODEL. */
    model?: string;
    temperature?: number;
    timeoutMs?: number;
    /** Total attempts including the first. */
    maxAttempts?: number;
}

export interface LlmResult<T> {
    value: T;
    meta: {
        operation: string;
        model: string;
        attempts: number;
        latencyMs: number;
    };
}

type Outcome = 'ok' | 'invalid' | 'error';

type JsonExtraction = { value: unknown } | { issues: string };

const extractJsonObject = (output: string): JsonExtraction => {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
        return { issues: 'no JSON object found in the reply' };
    }

    try {
        return { value: JSON.parse(output.slice(start, end + 1)) };
    } catch {
        return { issues: 'the JSON object was malformed' };
    }
};

const flattenZodIssues = (error: ZodError): string =>
    error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');

export class FalLlmClient {
    constructor(
        private readonly apiKey: string,
        private readonly logger?: Logger,
        private readonly defaults: { model?: string } = {}
    ) {}

    async completeStructured<T>(opts: CompleteStructuredOptions<T>): Promise<LlmResult<T>> {
        if (!this.apiKey) {
            throw Object.assign(new Error('AI is disabled on this server (FAL_KEY is not set)'), {
                status: 503,
                code: 'ai_disabled',
            });
        }

        const model = opts.model ?? this.defaults.model ?? DEFAULT_MODEL;
        const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

        const started = Date.now();
        let lastIssues = '';
        let lastOutput = '';

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const prompt =
                attempt === 1
                    ? opts.prompt
                    : `${opts.prompt}\n\nYour previous reply failed validation: ${lastIssues}. Return only corrected JSON, no prose.`;

            let output: string;

            try {
                output = await this.request(model, opts.system, prompt, temperature, timeoutMs);
            } catch (error) {
                this.log(
                    opts.operation,
                    model,
                    attempt,
                    Date.now() - started,
                    'error',
                    opts.prompt.length,
                    lastOutput.length
                );
                throw error;
            }

            lastOutput = output;

            const json = extractJsonObject(output);

            if ('issues' in json) {
                lastIssues = json.issues;
                continue;
            }

            const parsed = opts.schema.safeParse(json.value);

            if (parsed.success) {
                const latencyMs = Date.now() - started;
                this.log(opts.operation, model, attempt, latencyMs, 'ok', opts.prompt.length, output.length);

                return { value: parsed.data, meta: { operation: opts.operation, model, attempts: attempt, latencyMs } };
            }

            lastIssues = flattenZodIssues(parsed.error);
        }

        this.log(
            opts.operation,
            model,
            maxAttempts,
            Date.now() - started,
            'invalid',
            opts.prompt.length,
            lastOutput.length
        );
        throw fail(`LLM output failed validation after ${maxAttempts} attempts: ${lastIssues}`);
    }

    private async request(
        model: string,
        system: string,
        prompt: string,
        temperature: number,
        timeoutMs: number
    ): Promise<string> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            let response: Response;

            try {
                response = await fetch(FAL_ANY_LLM_URL, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Key ${this.apiKey}`,
                    },
                    body: JSON.stringify({ model, system_prompt: system, prompt, temperature }),
                });
            } catch (error) {
                throw fail(`fal.ai any-llm request failed: ${caughtErrorSchema.parse(error).message}`);
            }

            if (!response.ok) {
                let detail: string;

                try {
                    detail = (await response.text()).slice(0, 200);
                } catch {
                    detail = `HTTP ${response.status}`;
                }

                throw fail(`fal.ai any-llm error: ${detail}`);
            }

            let data: z.output<typeof replySchema>;

            try {
                data = replySchema.parse(await response.json());
            } catch {
                throw fail('fal.ai any-llm returned a non-JSON response body');
            }

            if (data.error) {
                throw fail(`fal.ai any-llm error: ${String(data.error).slice(0, 200)}`);
            }

            return data.output ?? '';
        } finally {
            clearTimeout(timer);
        }
    }

    private log(
        operation: string,
        model: string,
        attempts: number,
        latencyMs: number,
        outcome: Outcome,
        promptChars: number,
        outputChars: number
    ): void {
        this.logger?.info('llm call', { operation, model, attempts, latencyMs, outcome, promptChars, outputChars });
    }
}
