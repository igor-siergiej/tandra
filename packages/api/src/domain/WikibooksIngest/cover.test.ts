import { describe, expect, it, vi } from 'bun:test';

import { WikibooksCoverService } from './cover';
import type { WikibooksImageInfo } from './types';

const usable = (overrides: Partial<WikibooksImageInfo> = {}): WikibooksImageInfo => ({
    found: true,
    mime: 'image/jpeg',
    thumbUrl: 'https://upload.wikimedia.org/x/Baked_Ziti.jpg',
    descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Baked_Ziti.jpg',
    licenceShortName: 'CC BY 2.0',
    restrictions: '',
    artistHtml: 'Jane Doe',
    ...overrides,
});

const setup = (download = async () => ({ buffer: Buffer.from('jpeg-bytes'), contentType: 'image/jpeg' })) => {
    const stored = new Map<string, { buffer: Buffer; contentType?: string }>();

    const images = {
        getHeadObject: vi.fn(),
        getObjectStream: vi.fn(),
        putObject: vi.fn(async (name: string, buffer: Buffer, options?: { contentType: string }) => {
            stored.set(name, { buffer, contentType: options?.contentType });
        }),
    };

    const source = { downloadImage: vi.fn(download) };

    return { service: new WikibooksCoverService(source as never, images), stored, source, images };
};

describe('WikibooksCoverService', () => {
    it('downloads a reusable picture and stores it under a key of its own, with its credit', async () => {
        const { service, stored, source } = setup();

        const outcome = await service.resolve('wikibooks-7', 'Baked Ziti.jpg', usable());

        expect(source.downloadImage).toHaveBeenCalledWith('https://upload.wikimedia.org/x/Baked_Ziti.jpg');
        const key = outcome.fields.coverImageKey as string;
        expect(key).toMatch(/^discovery-image\/wikibooks-7\/\d+\.jpg$/);
        expect(stored.get(key)).toEqual({ buffer: Buffer.from('jpeg-bytes'), contentType: 'image/jpeg' });
        expect(outcome).toMatchObject({
            decided: true,
            fields: {
                coverImageAttribution: 'Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons',
                coverImageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Baked_Ziti.jpg',
            },
        });
    });

    it('has nothing to do, and is done, when the page names no picture', async () => {
        const { service, source } = setup();
        expect(await service.resolve('wikibooks-7', undefined, undefined)).toEqual({ fields: {}, decided: true });
        expect(source.downloadImage).not.toHaveBeenCalled();
    });

    it('treats a missing lookup as "not known yet" so the next run asks again', async () => {
        const { service, source } = setup();
        expect(await service.resolve('wikibooks-7', 'Baked Ziti.jpg', undefined)).toEqual({
            fields: {},
            decided: false,
        });
        expect(source.downloadImage).not.toHaveBeenCalled();
    });

    it.each([
        ['non-commercial', { licenceShortName: 'CC BY-NC 2.0' }],
        ['unlicensed', { licenceShortName: undefined }],
        ['a missing file', { found: false }],
        ['an unsupported type', { mime: 'image/gif' }],
    ])('refuses %s without downloading anything, and is done with it', async (_label, overrides) => {
        const { service, source, images } = setup();

        const outcome = await service.resolve('wikibooks-7', 'X.jpg', usable(overrides));

        expect(outcome).toMatchObject({ fields: {}, decided: true, refused: expect.any(String) });
        expect(source.downloadImage).not.toHaveBeenCalled();
        expect(images.putObject).not.toHaveBeenCalled();
    });

    it('is not done, and stores nothing, when the download fails', async () => {
        const { service, images } = setup(async () => {
            throw new Error('HTTP 429');
        });

        const outcome = await service.resolve('wikibooks-7', 'X.jpg', usable());

        expect(outcome).toEqual({ fields: {}, decided: false });
        expect(images.putObject).not.toHaveBeenCalled();
    });

    it('is not done when the object store write fails', async () => {
        const { service, images } = setup();
        images.putObject.mockRejectedValueOnce(new Error('bucket down'));

        expect(await service.resolve('wikibooks-7', 'X.jpg', usable())).toEqual({ fields: {}, decided: false });
    });

    it("trusts the wiki's type over a download header that is not an image", async () => {
        const { service, stored } = setup(async () => ({ buffer: Buffer.from('b'), contentType: 'text/html' }));

        const outcome = await service.resolve('wikibooks-7', 'X.png', usable({ mime: 'image/png' }));

        expect(outcome.fields.coverImageKey).toMatch(/\.png$/);
        expect([...stored.values()][0]?.contentType).toBe('image/png');
    });
});
