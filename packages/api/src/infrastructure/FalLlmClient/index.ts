import type { Logger } from '@imapps/api-utils';
import { type ZodType, z } from 'zod';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_TIMEOUT_MS = 15000;

const fail = (message: string): Error => Object.assign(new Error(message), { status: 502 });

export interface CompleteStructuredOptions<T> {
    /** Identifies the call in logs, e.g. 'recipe.parse'. */
    operation: string;
    /**
     * Gemini's decoding is constrained to the JSON schema built from this, and the reply is parsed against it.
     * `.transform()` is honoured on the reply; the request carries the schema's input shape.
     */
    schema: ZodType<T>;
    system: string;
    prompt: string;
    /** Falls back to the client's configured model, then DEFAULT_MODEL. */
    model?: string;
    timeoutMs?: number;
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

interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

interface GeminiReply {
    text: string;
    promptTokens?: number;
    outputTokens?: number;
}

const toJsonSchema = (schema: ZodType): Record<string, unknown> => {
    // The input shape is what the model must produce; the schemas' catch/preprocess/transform steps are lenient
    // about it and have no JSON-schema form of their own. `$schema` is not part of Gemini's schema dialect.
    const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });

    return jsonSchema;
};

const replyText = (data: GeminiResponse): string =>
    (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');

export class FalLlmClient {
    constructor(
        private readonly apiKey: string,
        private readonly logger?: Logger,
        private readonly defaults: { model?: string } = {}
    ) {}

    async completeStructured<T>(opts: CompleteStructuredOptions<T>): Promise<LlmResult<T>> {
        if (!this.apiKey) {
            throw Object.assign(new Error('AI is disabled on this server (GEMINI_API_KEY is not set)'), {
                status: 503,
                code: 'ai_disabled',
            });
        }

        const model = opts.model ?? this.defaults.model ?? DEFAULT_MODEL;
        const started = Date.now();
        const jsonSchema = toJsonSchema(opts.schema);

        let reply: GeminiReply;

        try {
            reply = await this.request(
                model,
                opts.system,
                opts.prompt,
                jsonSchema,
                opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
            );
        } catch (error) {
            this.log(opts, model, started, 'error');
            throw error;
        }

        let json: unknown;

        try {
            json = JSON.parse(reply.text);
        } catch {
            this.log(opts, model, started, 'invalid', reply);
            throw fail('LLM output was not valid JSON');
        }

        const parsed = opts.schema.safeParse(json);

        if (!parsed.success) {
            this.log(opts, model, started, 'invalid', reply);
            throw fail(
                `LLM output failed validation: ${parsed.error.issues
                    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                    .join('; ')}`
            );
        }

        const latencyMs = Date.now() - started;
        this.log(opts, model, started, 'ok', reply);

        return { value: parsed.data, meta: { operation: opts.operation, model, attempts: 1, latencyMs } };
    }

    private async request(
        model: string,
        system: string,
        prompt: string,
        jsonSchema: Record<string, unknown>,
        timeoutMs: number
    ): Promise<GeminiReply> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            let response: Response;

            try {
                response = await fetch(`${GEMINI_MODELS_URL}/${encodeURIComponent(model)}:generateContent`, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.apiKey,
                    },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: system }] },
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema },
                    }),
                });
            } catch (error) {
                throw fail(`Gemini request failed: ${(error as Error).message}`);
            }

            if (!response.ok) {
                let detail: string;

                try {
                    detail = (await response.text()).slice(0, 200);
                } catch {
                    detail = `HTTP ${response.status}`;
                }

                throw fail(`Gemini error: ${detail}`);
            }

            let data: GeminiResponse;

            try {
                data = (await response.json()) as GeminiResponse;
            } catch {
                throw fail('Gemini returned a non-JSON response body');
            }

            const text = replyText(data);

            if (!text) {
                throw fail('Gemini returned no text (blocked or empty reply)');
            }

            return {
                text,
                promptTokens: data.usageMetadata?.promptTokenCount,
                outputTokens: data.usageMetadata?.candidatesTokenCount,
            };
        } finally {
            clearTimeout(timer);
        }
    }

    private log(
        opts: CompleteStructuredOptions<unknown>,
        model: string,
        started: number,
        outcome: Outcome,
        reply?: GeminiReply
    ): void {
        this.logger?.info('llm call', {
            operation: opts.operation,
            model,
            attempts: 1,
            latencyMs: Date.now() - started,
            outcome,
            promptChars: opts.prompt.length,
            outputChars: reply?.text.length ?? 0,
            promptTokens: reply?.promptTokens,
            outputTokens: reply?.outputTokens,
        });
    }
}
