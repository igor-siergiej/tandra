import { beforeEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';

import { ImageService } from './index';

class MockImageStore {
    calls: Record<string, Array<Array<unknown>>> = {
        getHeadObject: [],
        getObjectStream: [],
        putObject: [],
    };

    resolvedValues: Record<string, unknown> = {
        getHeadObject: null,
        getObjectStream: null,
        putObject: undefined,
    };

    rejectedErrors: Record<string, Error | null> = {
        getHeadObject: null,
        getObjectStream: null,
        putObject: null,
    };

    async getHeadObject(objName: string) {
        this.calls.getHeadObject.push([objName]);

        if (this.rejectedErrors.getHeadObject) {
            throw this.rejectedErrors.getHeadObject;
        }

        return this.resolvedValues.getHeadObject;
    }

    async getObjectStream(objName: string) {
        this.calls.getObjectStream.push([objName]);

        if (this.rejectedErrors.getObjectStream) {
            throw this.rejectedErrors.getObjectStream;
        }

        return this.resolvedValues.getObjectStream;
    }

    async putObject(objName: string, buffer: unknown, options?: unknown) {
        this.calls.putObject.push([objName, buffer, options]);

        if (this.rejectedErrors.putObject) {
            throw this.rejectedErrors.putObject;
        }

        return this.resolvedValues.putObject;
    }

    reset() {
        this.calls = {
            getHeadObject: [],
            getObjectStream: [],
            putObject: [],
        };
        this.resolvedValues = {
            getHeadObject: null,
            getObjectStream: null,
            putObject: undefined,
        };
        this.rejectedErrors = {
            getHeadObject: null,
            getObjectStream: null,
            putObject: null,
        };
    }
}

class MockImageGenerator {
    generateImage: (prompt: string) => Promise<unknown> = async (prompt) => this.defaultGenerate(prompt);

    calls: Record<string, Array<Array<unknown>>> = {
        generateImage: [],
    };

    resolvedValues: Record<string, unknown> = {
        generateImage: null,
    };

    private async defaultGenerate(prompt: string) {
        this.calls.generateImage.push([prompt]);

        return this.resolvedValues.generateImage;
    }

    reset() {
        this.calls = { generateImage: [] };
        this.resolvedValues = { generateImage: null };
        this.generateImage = async (prompt) => this.defaultGenerate(prompt);
    }
}

class MockLogger implements Logger {
    calls: Record<string, Array<Array<unknown>>> = {
        info: [],
        warn: [],
        error: [],
        debug: [],
    };

    info(...args: unknown[]) {
        this.calls.info.push(args);
    }

    warn(...args: unknown[]) {
        this.calls.warn.push(args);
    }

    error(...args: unknown[]) {
        this.calls.error.push(args);
    }

    debug(...args: unknown[]) {
        this.calls.debug.push(args);
    }

    reset() {
        this.calls = {
            info: [],
            warn: [],
            error: [],
            debug: [],
        };
    }
}

const notFound = () => Object.assign(new Error('Not found'), { code: 'NotFound' });

const mockImageStore = new MockImageStore();
const mockImageGenerator = new MockImageGenerator();
const mockLogger = new MockLogger();

describe('ImageService', () => {
    let imageService: ImageService;

    beforeEach(() => {
        mockImageStore.reset();
        mockImageGenerator.reset();
        mockLogger.reset();
        imageService = new ImageService(mockImageStore, mockImageGenerator, mockLogger);
    });

    describe('getImage', () => {
        describe('When image exists in store', () => {
            it('should return image from store', async () => {
                const mockStream = {
                    read: () => {},
                } as unknown as NodeJS.ReadableStream;

                const mockHeadObject = {
                    metaData: { 'content-type': 'image/png' },
                };

                mockImageStore.resolvedValues.getHeadObject = mockHeadObject;
                mockImageStore.resolvedValues.getObjectStream = mockStream;

                const result = await imageService.getImage('test-image');

                expect(mockImageStore.calls.getHeadObject[0]).toEqual(['test-image.webp']);
                expect(mockImageStore.calls.getObjectStream[0]).toEqual(['test-image.webp']);
                expect(result.stream).toBe(mockStream);
                expect(result.contentType).toBe('image/png');
                expect(result.cacheControl).toBe('public, max-age=31536000, immutable');
            });

            it('should use default content type when metadata is missing', async () => {
                const mockStream = {
                    read: () => {},
                } as unknown as NodeJS.ReadableStream;

                const mockHeadObject = { metaData: {} };

                mockImageStore.resolvedValues.getHeadObject = mockHeadObject;
                mockImageStore.resolvedValues.getObjectStream = mockStream;

                const result = await imageService.getImage('test-image');

                expect(result.contentType).toBe('image/webp');
            });
        });

        describe('When image does not exist in store', () => {
            it('should generate new image and store it', async () => {
                const mockBuffer = Buffer.from('generated-image-data');

                mockImageStore.rejectedErrors.getHeadObject = notFound();
                mockImageGenerator.resolvedValues.generateImage = {
                    buffer: mockBuffer,
                    contentType: 'image/webp',
                };
                mockImageStore.resolvedValues.putObject = undefined;

                const result = await imageService.getImage('shopping-cart', 'u1');

                expect(mockImageGenerator.calls.generateImage[0]).toEqual([
                    'Minimalistic flat icon of a shopping-cart, centered and isolated on a plain pure white background. Simple, clean style for a shopping list item icon. Bright solid colors on the object only, soft rounded edges, modern vector look. No background shapes, no shadow, no text.',
                ]);
                expect(mockImageStore.calls.putObject[0]).toEqual([
                    'shopping-cart.webp',
                    mockBuffer,
                    { contentType: 'image/webp' },
                ]);
                expect(result.contentType).toBe('image/webp');
                expect(result.cacheControl).toBe('public, max-age=31536000, immutable');
            });

            it('should handle store upload failure gracefully', async () => {
                const mockBuffer = Buffer.from('generated-image-data');

                mockImageStore.rejectedErrors.getHeadObject = notFound();
                mockImageGenerator.resolvedValues.generateImage = {
                    buffer: mockBuffer,
                    contentType: 'image/webp',
                };
                mockImageStore.rejectedErrors.putObject = new Error('Upload failed');

                const result = await imageService.getImage('test-item', 'u1');

                expect(mockLogger.calls.error.length).toBeGreaterThan(0);
                expect(mockLogger.calls.error[0][0]).toBe('Failed to store generated image');
                expect(result.contentType).toBe('image/webp');
            });

            it('should work without logger', async () => {
                mockImageStore.reset();
                mockImageGenerator.reset();
                const serviceWithoutLogger = new ImageService(mockImageStore, mockImageGenerator);
                const mockBuffer = Buffer.from('generated-image-data');

                mockImageStore.rejectedErrors.getHeadObject = notFound();
                mockImageGenerator.resolvedValues.generateImage = {
                    buffer: mockBuffer,
                    contentType: 'image/webp',
                };
                mockImageStore.rejectedErrors.putObject = new Error('Upload failed');

                const result = await serviceWithoutLogger.getImage('test-item', 'u1');

                expect(result.contentType).toBe('image/webp');
            });
        });

        describe('When image name is invalid', () => {
            it('should throw error for empty name', async () => {
                await expect(imageService.getImage('')).rejects.toThrow('Image name is required');
            });

            it('should throw error for null name', async () => {
                await expect(imageService.getImage(null as any)).rejects.toThrow('Image name is required');
            });

            it('should throw error for undefined name', async () => {
                await expect(imageService.getImage(undefined as any)).rejects.toThrow('Image name is required');
            });
        });

        describe('When generating prompt', () => {
            it('should normalize name to lowercase and trim whitespace', async () => {
                const mockBuffer = Buffer.from('generated-image-data');

                mockImageStore.rejectedErrors.getHeadObject = notFound();
                mockImageGenerator.resolvedValues.generateImage = {
                    buffer: mockBuffer,
                    contentType: 'image/webp',
                };

                await imageService.getImage('  SHOPPING CART  ', 'u1');

                expect(mockImageGenerator.calls.generateImage[0]).toEqual([
                    'Minimalistic flat icon of a shopping cart, centered and isolated on a plain pure white background. Simple, clean style for a shopping list item icon. Bright solid colors on the object only, soft rounded edges, modern vector look. No background shapes, no shadow, no text.',
                ]);
            });
        });

        describe('Stream read callback', () => {
            it('should return readable stream that contains the buffer data', async () => {
                const mockBuffer = Buffer.from('test-image-data-content');

                mockImageStore.rejectedErrors.getHeadObject = notFound();
                mockImageGenerator.resolvedValues.generateImage = {
                    buffer: mockBuffer,
                    contentType: 'image/webp',
                };

                const result = await imageService.getImage('test-image', 'u1');
                const stream = result.stream;

                // Consume the stream and collect chunks
                const chunks: Buffer[] = [];

                return new Promise((resolve, reject) => {
                    stream.on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    });

                    stream.on('end', () => {
                        const fullData = Buffer.concat(chunks);
                        expect(fullData).toEqual(mockBuffer);
                        resolve(undefined);
                    });

                    stream.on('error', reject);

                    // Trigger the read() callback by reading from the stream
                    stream.read();
                });
            });

            it('should stream cached image data properly', async () => {
                const mockBuffer = Buffer.from('cached-image-data-content');

                const mockStream = {
                    on: function (event: string, callback: (data?: Buffer) => void) {
                        if (event === 'data') {
                            // Simulate stream emitting data
                            setTimeout(() => {
                                callback(mockBuffer);
                            }, 0);
                        } else if (event === 'end') {
                            setTimeout(() => {
                                callback();
                            }, 10);
                        }

                        return this;
                    },
                    read: () => {},
                } as unknown as NodeJS.ReadableStream;

                const mockHeadObject = {
                    metaData: { 'content-type': 'image/png' },
                };

                mockImageStore.resolvedValues.getHeadObject = mockHeadObject;
                mockImageStore.resolvedValues.getObjectStream = mockStream;

                const result = await imageService.getImage('cached-test-image');
                const stream = result.stream;

                // Verify stream is returned
                expect(stream).toBe(mockStream);
                expect(result.contentType).toBe('image/png');
            });
        });
    });
    describe('generation guards', () => {
        const generated = { buffer: Buffer.from('img'), contentType: 'image/webp' };

        it('rejects a cache miss from an anonymous caller without generating', async () => {
            mockImageStore.rejectedErrors.getHeadObject = notFound();

            await expect(imageService.getImage('apple')).rejects.toMatchObject({ status: 401 });
            expect(mockImageGenerator.calls.generateImage).toHaveLength(0);
        });

        it('returns 503 instead of generating when the store fails for a reason other than not-found', async () => {
            mockImageStore.rejectedErrors.getHeadObject = new Error('connect ECONNREFUSED');

            await expect(imageService.getImage('apple', 'u1')).rejects.toMatchObject({ status: 503 });
            expect(mockImageGenerator.calls.generateImage).toHaveLength(0);
        });

        it('generates once for concurrent misses of the same name', async () => {
            mockImageStore.rejectedErrors.getHeadObject = notFound();
            let release: () => void = () => {};

            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });

            mockImageGenerator.generateImage = async (prompt: string) => {
                mockImageGenerator.calls.generateImage.push([prompt]);
                await gate;

                return generated;
            };

            const pending = Promise.all([
                imageService.getImage('pear', 'u1'),
                imageService.getImage('pear', 'u2'),
                imageService.getImage('Pear ', 'u3'),
            ]);

            await new Promise((resolve) => setTimeout(resolve, 0));
            release();
            await pending;

            expect(mockImageGenerator.calls.generateImage).toHaveLength(1);
            expect(mockImageStore.calls.putObject).toHaveLength(1);
        });

        it('caps generations per user per day', async () => {
            mockImageStore.rejectedErrors.getHeadObject = notFound();
            mockImageGenerator.resolvedValues.generateImage = generated;

            for (let i = 0; i < 50; i++) {
                await imageService.getImage(`item-${i}`, 'u1');
            }

            await expect(imageService.getImage('one-too-many', 'u1')).rejects.toMatchObject({ status: 429 });
            await expect(imageService.getImage('other-user-item', 'u2')).resolves.toBeDefined();
        });
    });
});
