import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { FalImageGenerator } from './index';

const mockSharpInstance = {
    resize: vi.fn(),
    webp: vi.fn(),
    withMetadata: vi.fn(),
    toBuffer: vi.fn(),
};

mockSharpInstance.resize.mockReturnValue(mockSharpInstance);

mockSharpInstance.webp.mockReturnValue(mockSharpInstance);

mockSharpInstance.withMetadata.mockReturnValue(mockSharpInstance);

const mockProcessImage = vi.fn();
const mockSharp = vi.fn().mockImplementation(() => mockSharpInstance);

// Injected rather than vi.mock'd: bun keeps module mocks alive for every other test file in the run.
const options = { processor: mockProcessImage, sharpFactory: mockSharp as never };

const dataUri = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`;

describe('FalImageGenerator', () => {
    let generator: FalImageGenerator;

    beforeEach(() => {
        vi.clearAllMocks();
        generator = new FalImageGenerator('test-api-key', options);
        mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
        mockSharpInstance.webp.mockReturnValue(mockSharpInstance);
        mockSharpInstance.withMetadata.mockReturnValue(mockSharpInstance);
    });

    describe('When apiKey is empty', () => {
        it('should throw an error', async () => {
            const generatorNoKey = new FalImageGenerator('', options);

            await expect(generatorNoKey.generateImage('test prompt')).rejects.toMatchObject({
                message: expect.stringContaining('AI is disabled'),
                status: 503,
                code: 'ai_disabled',
            });
        });
    });

    describe('When request options are provided', () => {
        it('should send prompt, model and params to the fal endpoint', async () => {
            const processedBuffer = Buffer.from('processed-bytes');
            mockProcessImage.mockResolvedValue(processedBuffer);

            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ images: [{ url: dataUri(Buffer.from('img')) }] }),
            });

            global.fetch = fetchMock;

            const recipeGenerator = new FalImageGenerator('key', {
                model: 'fal-ai/flux/schnell',
                imageSize: 'square_hd',
                outputFormat: 'jpeg',
                numInferenceSteps: 4,
                outputSize: 512,
                ...options,
            });

            await recipeGenerator.generateImage('a nice recipe');

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe('https://fal.run/fal-ai/flux/schnell');
            expect(init.headers.Authorization).toBe('Key key');
            const body = JSON.parse(init.body);
            expect(body).toMatchObject({
                prompt: 'a nice recipe',
                image_size: 'square_hd',
                output_format: 'jpeg',
                num_inference_steps: 4,
                num_images: 1,
                sync_mode: true,
            });
            expect(mockProcessImage).toHaveBeenCalledWith(expect.any(Buffer), undefined, 512);
        });
    });

    describe('When fal API returns an error', () => {
        it('should throw a 502 error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                text: vi.fn().mockResolvedValue('Unauthorized'),
            });

            await expect(generator.generateImage('test prompt')).rejects.toMatchObject({
                status: 502,
            });
        });
    });

    describe('When response contains a data URI', () => {
        it('should decode base64 and process the image', async () => {
            const imageBuffer = Buffer.from('fake-image-bytes');
            const processedBuffer = Buffer.from('processed-bytes');
            mockProcessImage.mockResolvedValue(processedBuffer);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ images: [{ url: dataUri(imageBuffer) }] }),
            });

            const result = await generator.generateImage('test prompt');

            expect(mockProcessImage).toHaveBeenCalledWith(imageBuffer, undefined, 256);
            expect(result.buffer).toEqual(processedBuffer);
            expect(result.contentType).toBe('image/webp');
        });
    });

    describe('When response contains a hosted URL', () => {
        it('should fetch the image from the URL and process it', async () => {
            const imageBuffer = Buffer.from('url-image-bytes');
            const processedBuffer = Buffer.from('processed-url-bytes');
            mockProcessImage.mockResolvedValue(processedBuffer);

            global.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: vi.fn().mockResolvedValue({ images: [{ url: 'https://cdn.fal.ai/image.png' }] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: vi.fn().mockResolvedValue(imageBuffer.buffer),
                });

            const result = await generator.generateImage('test prompt');

            expect(result.contentType).toBe('image/webp');
            expect(result.buffer).toEqual(processedBuffer);
        });
    });

    describe('When URL fetch fails', () => {
        it('should throw a 502 error', async () => {
            global.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: vi.fn().mockResolvedValue({ images: [{ url: 'https://cdn.fal.ai/image.png' }] }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                });

            await expect(generator.generateImage('test prompt')).rejects.toMatchObject({ status: 502 });
        });
    });

    describe('When response has no image url', () => {
        it('should throw a 502 error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ images: [{}] }),
            });

            await expect(generator.generateImage('test prompt')).rejects.toMatchObject({ status: 502 });
        });
    });

    describe('When response images is empty', () => {
        it('should throw a 502 error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ images: [] }),
            });

            await expect(generator.generateImage('test prompt')).rejects.toMatchObject({ status: 502 });
        });
    });

    describe('When processImage fails', () => {
        it('should fallback to sharp webp conversion', async () => {
            const imageBuffer = Buffer.from('raw-bytes');
            const fallbackBuffer = Buffer.from('fallback-webp');
            mockProcessImage.mockRejectedValue(new Error('Sharp resize error'));
            mockSharpInstance.toBuffer.mockResolvedValue(fallbackBuffer);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ images: [{ url: dataUri(imageBuffer) }] }),
            });

            const result = await generator.generateImage('test prompt');

            expect(result.contentType).toBe('image/webp');
            expect(result.buffer).toEqual(fallbackBuffer);
        });

        it('should fallback to original buffer when all processing fails', async () => {
            const imageBuffer = Buffer.from('raw-bytes');
            mockProcessImage.mockRejectedValue(new Error('Sharp resize error'));
            mockSharpInstance.toBuffer.mockRejectedValue(new Error('Sharp webp error'));

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ images: [{ url: dataUri(imageBuffer) }] }),
            });

            const result = await generator.generateImage('test prompt');

            expect(result.contentType).toBe('image/png');
            expect(result.buffer).toEqual(imageBuffer);
        });
    });
});
