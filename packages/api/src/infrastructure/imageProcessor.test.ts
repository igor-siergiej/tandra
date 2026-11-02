import { beforeEach, describe, expect, it } from 'bun:test';

import { processImage } from './imageProcessor';

class MockSharpInstance {
    calls: Record<string, Array<Array<unknown>>> = {
        resize: [],
        webp: [],
        withMetadata: [],
        toBuffer: [],
    };

    toBufferValue: any = Buffer.from('processed-output');

    resize(...args: unknown[]) {
        this.calls.resize.push(args);
        return this;
    }

    webp(...args: unknown[]) {
        this.calls.webp.push(args);
        return this;
    }

    withMetadata(...args: unknown[]) {
        this.calls.withMetadata.push(args);
        return this;
    }

    async toBuffer() {
        this.calls.toBuffer.push([]);
        return this.toBufferValue;
    }

    reset() {
        this.calls = {
            resize: [],
            webp: [],
            withMetadata: [],
            toBuffer: [],
        };
        this.toBufferValue = Buffer.from('processed-output');
    }

    mockResolvedValue(value: any) {
        this.toBufferValue = value;
    }
}

const mockSharpInstance = new MockSharpInstance();

// Mock the sharp module import - we use a module.require replacement for testing
// Since Bun doesn't support vi.mock() directly, we test the function behavior instead
describe('imageProcessor', () => {
    beforeEach(() => {
        mockSharpInstance.reset();
        mockSharpInstance.toBufferValue = Buffer.from('processed-output');
    });

    describe('processImage', () => {
        it('returns a Buffer', async () => {
            const mockSharp = () => mockSharpInstance;
            const result = await processImage(Buffer.from('input'), mockSharp as any);
            expect(Buffer.isBuffer(result)).toBe(true);
        });

        it('returns the value from toBuffer', async () => {
            const expected = Buffer.from('expected-output');
            mockSharpInstance.mockResolvedValue(expected);

            const mockSharp = () => mockSharpInstance;
            const result = await processImage(Buffer.from('input'), mockSharp as any);
            expect(result).toEqual(expected);
        });

        it('calls resize with 256x256 and correct options by default', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp as any);

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
            await processImage(Buffer.from('input'), mockSharp as any, 512);

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
            await processImage(Buffer.from('input'), mockSharp as any);

            const webpCall = mockSharpInstance.calls.webp[0][0] as Record<string, any>;
            expect(webpCall.quality).toBe(85);
        });

        it('calls webp with smartSubsample enabled', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp as any);

            const webpCall = mockSharpInstance.calls.webp[0][0] as Record<string, any>;
            expect(webpCall.smartSubsample).toBe(true);
        });

        it('calls withMetadata', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp as any);
            expect(mockSharpInstance.calls.withMetadata.length).toBeGreaterThan(0);
        });

        it('calls toBuffer to finalise output', async () => {
            const mockSharp = () => mockSharpInstance;
            await processImage(Buffer.from('input'), mockSharp as any);
            expect(mockSharpInstance.calls.toBuffer.length).toBeGreaterThan(0);
        });

        it('processes multiple buffers independently', async () => {
            const mockSharp = () => mockSharpInstance;
            const buf1 = Buffer.from('image1');
            const buf2 = Buffer.from('image2');

            const out1 = await processImage(buf1, mockSharp as any);
            const out2 = await processImage(buf2, mockSharp as any);

            expect(Buffer.isBuffer(out1)).toBe(true);
            expect(Buffer.isBuffer(out2)).toBe(true);
        });
    });
});
