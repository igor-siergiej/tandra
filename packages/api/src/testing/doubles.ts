import { mock } from 'bun:test';
import { Readable } from 'node:stream';

import type { PushSubscription } from '@tandra/types';

import type { ImageGenerator, ImageStore } from '../domain/ImageService/types';
import type { FalLlmClient, LlmResult } from '../infrastructure/FalLlmClient';
import type { SendResult } from '../infrastructure/WebPushSender';
import { fake } from './fake';

type StoreCalls = {
    getHeadObject: Array<Parameters<ImageStore['getHeadObject']>>;
    getObjectStream: Array<Parameters<ImageStore['getObjectStream']>>;
    putObject: Array<Parameters<ImageStore['putObject']>>;
};

type StoreResults = {
    getHeadObject: Awaited<ReturnType<ImageStore['getHeadObject']>>;
    getObjectStream: NodeJS.ReadableStream;
};

type StoreFailures = { getHeadObject?: Error; getObjectStream?: Error; putObject?: Error };

const noStoreCalls = (): StoreCalls => ({ getHeadObject: [], getObjectStream: [], putObject: [] });

const defaultStoreResults = (): StoreResults => ({ getHeadObject: null, getObjectStream: Readable.from([]) });

/** An image store that records each call and answers with the value or error a test sets. */
export class RecordingImageStore implements ImageStore {
    calls = noStoreCalls();

    resolvedValues = defaultStoreResults();

    rejectedErrors: StoreFailures = {};

    async getHeadObject(...args: Parameters<ImageStore['getHeadObject']>) {
        this.calls.getHeadObject.push(args);

        if (this.rejectedErrors.getHeadObject) throw this.rejectedErrors.getHeadObject;

        return this.resolvedValues.getHeadObject;
    }

    async getObjectStream(...args: Parameters<ImageStore['getObjectStream']>) {
        this.calls.getObjectStream.push(args);

        if (this.rejectedErrors.getObjectStream) throw this.rejectedErrors.getObjectStream;

        return this.resolvedValues.getObjectStream;
    }

    async putObject(...args: Parameters<ImageStore['putObject']>) {
        this.calls.putObject.push(args);

        if (this.rejectedErrors.putObject) throw this.rejectedErrors.putObject;
    }

    reset() {
        this.calls = noStoreCalls();
        this.resolvedValues = defaultStoreResults();
        this.rejectedErrors = {};
    }
}

type GeneratedImage = Awaited<ReturnType<ImageGenerator['generateImage']>>;

const emptyImage = (): GeneratedImage => ({ buffer: Buffer.alloc(0), contentType: 'image/webp' });

/** An image generator that records prompts and answers with `resolvedValues.generateImage`. */
export class RecordingImageGenerator implements ImageGenerator {
    /** Replaceable per test, e.g. to hold a generation open; `reset` restores the recording default. */
    generateImage = async (prompt: string) => this.defaultGenerate(prompt);

    calls = { generateImage: new Array<[string]>() };

    resolvedValues = { generateImage: emptyImage() };

    private async defaultGenerate(prompt: string) {
        this.calls.generateImage.push([prompt]);

        return this.resolvedValues.generateImage;
    }

    reset() {
        this.calls = { generateImage: new Array<[string]>() };
        this.resolvedValues = { generateImage: emptyImage() };
        this.generateImage = async (prompt) => this.defaultGenerate(prompt);
    }
}

type LogCalls = { info: string[][]; warn: string[][]; error: string[][]; debug: string[][] };

const noLogCalls = (): LogCalls => ({ info: [], warn: [], error: [], debug: [] });

/** A logger that keeps the message of each line, by level. Hand it to code under test through `fake`. */
export class RecordingLogger {
    calls = noLogCalls();

    info(message: string) {
        this.calls.info.push([message]);
    }

    warn(message: string) {
        this.calls.warn.push([message]);
    }

    error(message: string) {
        this.calls.error.push([message]);
    }

    debug(message: string) {
        this.calls.debug.push([message]);
    }

    reset() {
        this.calls = noLogCalls();
    }
}

/** What a test's LLM double is asked: the options the client under test passes to `completeStructured`. */
export type LlmRequest = Parameters<FalLlmClient['completeStructured']>[0];

/**
 * An LLM client that answers with `reply` and, like the real client, parses the answer through the caller's schema,
 * so a canned reply that does not fit the schema fails the test the way a bad model reply would fail in production.
 */
export const llmReplying = (reply: (request: LlmRequest) => Promise<LlmResult<unknown>>): FalLlmClient =>
    fake({
        completeStructured: async (request) => {
            const { value, meta } = await reply(request);

            return { value: request.schema.parse(value), meta };
        },
    });

/** A fetch implementation a test supplies: the call signature of `fetch`, without Bun's static extras. */
export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** `impl` as a full `fetch`, carrying over Bun's `preconnect` so it can stand in for the global or an injected one. */
export const asFetch = (impl: FetchImpl): typeof fetch =>
    Object.assign(impl, { preconnect: globalThis.fetch.preconnect });

/** Replaces the global `fetch` with `impl`; restore the original in `afterEach`. */
export const stubFetch = (impl: FetchImpl): void => {
    globalThis.fetch = asFetch(impl);
};

/** A configured push sender that accepts every push; `send.mock.calls` holds each subscription and JSON payload. */
export const acceptingPushSender = () => ({
    send: mock(async (_subscription: PushSubscription, _payload: string): Promise<SendResult> => 'ok'),
    isConfigured: () => true,
});
