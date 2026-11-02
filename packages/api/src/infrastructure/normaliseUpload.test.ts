import { describe, expect, it } from 'bun:test';

import sharp from 'sharp';

import { normaliseUpload } from './imageProcessor';

const raster = (width: number, height: number, format: 'png' | 'jpeg' | 'gif') =>
    sharp({ create: { width, height, channels: 3, background: '#336699' } })
        .toFormat(format)
        .toBuffer();

describe('normaliseUpload', () => {
    it.each(['png', 'jpeg', 'gif'] as const)('re-encodes %s as WebP', async (format) => {
        const out = await normaliseUpload(await raster(16, 16, format));

        expect((await sharp(out).metadata()).format).toBe('webp');
    });

    it('downsizes oversized images to at most 2048px on the long edge', async () => {
        const out = await normaliseUpload(await raster(3000, 1000, 'png'));
        const meta = await sharp(out).metadata();

        expect(meta.width).toBe(2048);
        expect(meta.height).toBeLessThanOrEqual(2048);
    });

    it('does not enlarge small images', async () => {
        const meta = await sharp(await normaliseUpload(await raster(20, 10, 'png'))).metadata();

        expect([meta.width, meta.height]).toEqual([20, 10]);
    });

    it('rejects SVG', async () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>');

        await expect(normaliseUpload(svg)).rejects.toMatchObject({ status: 400 });
    });

    it('rejects arbitrary bytes', async () => {
        await expect(normaliseUpload(Buffer.from('not an image at all'))).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an empty buffer', async () => {
        await expect(normaliseUpload(Buffer.alloc(0))).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a decompression bomb above the pixel limit', async () => {
        const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: '#000' } })
            .png({ compressionLevel: 9 })
            .toBuffer();

        await expect(normaliseUpload(bomb)).rejects.toMatchObject({ status: 400 });
    });
});
