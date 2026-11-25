import { beforeEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';

import { ImageService } from './index';

// The privacy notice promises logs hold no list-item text: the item an image was requested for must not be logged.
const ITEM_NAME = 'Dragonfruit-Item-Name';

const calls: Array<{ level: string; args: unknown[] }> = [];

const logger = {
    info: (...args: unknown[]) => calls.push({ level: 'info', args }),
    warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
    error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    debug: (...args: unknown[]) => calls.push({ level: 'debug', args }),
} as unknown as Logger;

const loggedText = (): string =>
    JSON.stringify(calls, (_key, value) =>
        value instanceof Error ? { name: value.name, message: value.message } : value
    ).toLowerCase();

const notFound = () => Object.assign(new Error('Not found'), { code: 'NotFound' });
const image = { buffer: Buffer.from('image'), contentType: 'image/webp' };

describe('ImageService logging', () => {
    let storeState: { head: 'hit' | 'missing' | 'down'; putFails: boolean };
    let generatorFails: boolean;
    let service: ImageService;

    beforeEach(() => {
        calls.length = 0;
        storeState = { head: 'missing', putFails: false };
        generatorFails = false;

        const store = {
            getHeadObject: async () => {
                if (storeState.head === 'missing') throw notFound();

                if (storeState.head === 'down') throw new Error('connection refused');

                return { metaData: { 'content-type': 'image/webp' } };
            },
            getObjectStream: async () => ({}) as NodeJS.ReadableStream,
            putObject: async () => {
                if (storeState.putFails) throw new Error('disk full');
            },
        };

        const generator = {
            generateImage: async () => {
                if (generatorFails) throw new Error('generator down');

                return image;
            },
        };

        service = new ImageService(store, generator, logger);
    });

    it('should log no item name when an image is served from the store', async () => {
        storeState.head = 'hit';

        await service.getImage(ITEM_NAME, 'user-1');

        expect(calls.length).toBeGreaterThan(0);
        expect(loggedText()).not.toContain(ITEM_NAME.toLowerCase());
    });

    it('should log no item name when an image is generated', async () => {
        await service.getImage(ITEM_NAME, 'user-1');

        expect(calls.length).toBeGreaterThan(0);
        expect(loggedText()).not.toContain(ITEM_NAME.toLowerCase());
    });

    it('should log no item name when storing the generated image fails', async () => {
        storeState.putFails = true;

        await service.getImage(ITEM_NAME, 'user-1');

        expect(calls.some((c) => c.level === 'error')).toBe(true);
        expect(loggedText()).not.toContain(ITEM_NAME.toLowerCase());
    });

    it('should log no item name when generation fails', async () => {
        generatorFails = true;

        await expect(service.getImage(ITEM_NAME, 'user-1')).rejects.toThrow('generator down');

        expect(calls.some((c) => c.level === 'error')).toBe(true);
        expect(loggedText()).not.toContain(ITEM_NAME.toLowerCase());
    });

    it('should log no item name when the store is unavailable', async () => {
        storeState.head = 'down';

        await expect(service.getImage(ITEM_NAME, 'user-1')).rejects.toThrow();

        expect(calls.some((c) => c.level === 'error')).toBe(true);
        expect(loggedText()).not.toContain(ITEM_NAME.toLowerCase());
    });

    it('should log no item name when an anonymous caller asks for an image that has to be generated', async () => {
        await expect(service.getImage(ITEM_NAME)).rejects.toThrow();

        expect(loggedText()).not.toContain(ITEM_NAME.toLowerCase());
    });
});
