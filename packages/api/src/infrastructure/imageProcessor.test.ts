import { beforeEach, describe, expect, it } from 'bun:test';

import { type ImagePipeline, processImage } from './imageProcessor';

type PipelineCalls = {
    resize: Array<Parameters<ImagePipeline['resize']>>;
    webp: Array<Parameters<ImagePipeline['webp']>>;
    withMetadata: Array<Parameters<ImagePipeline['withMetadata']>>;
    toBuffer: Array<[]>;
};

const noCalls = (): PipelineCalls => ({ resize: [], webp: [], withMetadata: [], toBuffer: [] });

/** Records every pipeline step and resolves toBuffer with a set value. */
class MockSharpInstance implements ImagePipeline {
    calls = noCalls();

    toBufferValue: Buffer = Buffer.from('processed-output');

    resize(...args: Parameters<ImagePipeline['resize']>) {
        this.calls.resize.push(args);

        return this;
    }

    webp(...args: Parameters<ImagePipeline['webp']>) {
        this.calls.webp.push(args);

        return this;
    }

    withMetadata(...args: Parameters<ImagePipeline['withMetadata']>) {
        this.calls.withMetadata.push(args);

        return this;
    }

    async toBuffer() {
        this.calls.toBuffer.push([]);

        return this.toBufferValue;
    }

    reset() {
        this.calls = noCalls();
        this.toBufferValue = Buffer.from('processed-output');
    }

    mockResolvedValue(value: Buffer) {
        this.toBufferValue = value;
    }
}

const mockSharpInstance = new MockSharpInstance();

describe('imageProcessor', () => {
    beforeEach(() => {
        mockSharpInstance.reset();
        mockSharpInstance.toBufferValue = Buffer.from('processed-output');
    });

    describe('processImage', () => {
        it('returns a Buffer', async () => {
            const mockSharp = () => mockSharpInstance;
            const result = await processImage(Buffer.from('input'), mockSharp);
            expect(Buffer.isBuffer(result)).toBe(true);
        });

        it('returns the value from toBuffer', async () => {
            const expected = Buffer.from('expected-output');
            mockSharpInstance.mockResolvedValue(expected);

            const mockSharp = () => mockSharpInstance;
            const result = await processImage(Buffer.from('input'), mockSharp);
            expect(result).toEqual(expected);
        });

        it('calls resize with 256x256 and correct options by default', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp);

            expect(mockSharpInstance.calls.resize[0]).toEqual([
                256,
                256,
                {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                    withoutEnlargement: true,
                },
            ]);
        });

        it('calls resize with custom size when provided', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp, 512);

            expect(mockSharpInstance.calls.resize[0]).toEqual([
                512,
                512,
                {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                    withoutEnlargement: true,
                },
            ]);
        });

        it('calls webp with quality 85', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp);

            const [webpCall] = mockSharpInstance.calls.webp[0];
            expect(webpCall.quality).toBe(85);
        });

        it('calls webp with smartSubsample enabled', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp);

            const [webpCall] = mockSharpInstance.calls.webp[0];
            expect(webpCall.smartSubsample).toBe(true);
        });

        it('calls withMetadata', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp);
            expect(mockSharpInstance.calls.withMetadata.length).toBeGreaterThan(0);
        });

        it('calls toBuffer to finalise output', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp);
            expect(mockSharpInstance.calls.toBuffer.length).toBeGreaterThan(0);
        });

        it('processes multiple buffers independently', async () => {
            const mockSharp = () => mockSharpInstance;
            const buf1 = Buffer.from('image1');
            const buf2 = Buffer.from('image2');

            const out1 = await processImage(buf1, mockSharp);
            const out2 = await processImage(buf2, mockSharp);

            expect(Buffer.isBuffer(out1)).toBe(true);
            expect(Buffer.isBuffer(out2)).toBe(true);
        });
    });
});
