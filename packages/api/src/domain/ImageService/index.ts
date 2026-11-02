import type { Logger } from '@imapps/api-utils';
import { z } from 'zod';

import { imageGenerationFailuresTotal, imagesGeneratedTotal, imagesServedTotal } from '../../infrastructure/metrics';
import { withImageExtension } from '../../infrastructure/objectKey';
import type { ImageGenerator, ImageStore } from './types';

const DAILY_GENERATION_CAP = 50;

const storeErrorSchema = z
    .looseObject({
        code: z.string().optional().catch(undefined),
        statusCode: z.number().optional().catch(undefined),
    })
    .catch({});

const isNotFound = (cause: unknown): boolean => {
    const e = storeErrorSchema.parse(cause);

    return e.code === 'NotFound' || e.code === 'NoSuchKey' || e.statusCode === 404;
};

const httpError = (message: string, status: number) => Object.assign(new Error(message), { status });

export class ImageService {
    private readonly inFlight = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();
    private readonly usage = new Map<string, { day: string; count: number }>();

    constructor(
        private readonly store: ImageStore,
        private readonly generator: ImageGenerator,
        private readonly logger?: Logger
    ) {}

    async getImage(
        name: string,
        userId?: string
    ): Promise<{
        stream: NodeJS.ReadableStream;
        contentType: string;
        cacheControl: string;
    }> {
        try {
            if (!name) {
                throw Object.assign(new Error('Image name is required'), { status: 400 });
            }

            const normalisedName = name.trim().toLowerCase();
            // AI item images are always WebP, so the storage key carries a fixed .webp extension.
            const storageKey = withImageExtension(normalisedName, 'image/webp');

            // Try to fetch from store first
            try {
                const head = await this.store.getHeadObject(storageKey);
                const contentType = head?.metaData?.['content-type'] ?? 'image/webp';
                const stream = await this.store.getObjectStream(storageKey);

                this.logger?.info('Image retrieved from cache', {
                    itemName: normalisedName,
                    contentType,
                    source: 'cache',
                });

                imagesServedTotal.inc({ source: 'cache' });

                return {
                    stream,
                    contentType,
                    cacheControl: 'public, max-age=31536000, immutable',
                };
            } catch (storeErr) {
                if (!isNotFound(storeErr)) {
                    throw httpError('Image storage unavailable', 503);
                }

                this.logger?.warn('Image not found in store, falling back to generator', {
                    itemName: normalisedName,
                });
            }

            if (!userId) {
                throw httpError('Authentication required to generate images', 401);
            }

            const { buffer, contentType } = await this.generateOnce(storageKey, normalisedName, userId);

            this.logger?.info('Image generated using AI', {
                itemName: normalisedName,
                contentType,
                source: 'fal',
            });

            imagesServedTotal.inc({ source: 'fresh' });

            return {
                stream: this.bufferToStream(buffer),
                contentType,
                cacheControl: 'public, max-age=31536000, immutable',
            };
        } catch (error) {
            this.logger?.error('Failed to get image', {
                itemName: name,
                error,
            });
            throw error;
        }
    }

    private generateOnce(storageKey: string, name: string, userId: string) {
        const existing = this.inFlight.get(storageKey);

        if (existing) {
            return existing;
        }

        this.consumeQuota(userId);

        const run = (async () => {
            let result: { buffer: Buffer; contentType: string };

            try {
                result = await this.generator.generateImage(this.generatePrompt(name));
            } catch (genErr) {
                imageGenerationFailuresTotal.inc({ provider: 'fal' });
                throw genErr;
            }

            imagesGeneratedTotal.inc({ provider: 'fal' });

            try {
                await this.store.putObject(storageKey, result.buffer, { contentType: result.contentType });
            } catch (uploadErr) {
                this.logger?.error('Failed to store generated image', { itemName: name, error: uploadErr });
            }

            return result;
        })().finally(() => this.inFlight.delete(storageKey));

        this.inFlight.set(storageKey, run);

        return run;
    }

    private consumeQuota(userId: string) {
        const day = new Date().toISOString().slice(0, 10);
        const entry = this.usage.get(userId);
        const count = entry?.day === day ? entry.count : 0;

        if (count >= DAILY_GENERATION_CAP) {
            throw httpError('Daily image generation limit reached', 429);
        }

        this.usage.set(userId, { day, count: count + 1 });
    }

    private generatePrompt(name: string): string {
        return `Minimalistic flat icon of a ${name}, centered and isolated on a plain pure white background. Simple, clean style for a shopping list item icon. Bright solid colors on the object only, soft rounded edges, modern vector look. No background shapes, no shadow, no text.`;
    }

    private bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
        const { Readable } = require('node:stream');

        return new Readable({
            read() {
                this.push(buffer);
                this.push(null);
            },
        });
    }
}
