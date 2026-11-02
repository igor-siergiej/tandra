import { beforeEach, describe, expect, it } from 'bun:test';

import type { ObjectStoreConnection } from '@imapps/api-utils';

import { BucketStore } from './index';

class MockObjectStore {
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

    getObjectStream(objName: string) {
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

const mockObjectStore = new MockObjectStore();
const mockConnection = mockObjectStore as unknown as ObjectStoreConnection;

describe('BucketStore', () => {
    let bucketStore: BucketStore;

    beforeEach(() => {
        mockObjectStore.reset();
        bucketStore = new BucketStore(mockConnection);
    });

    describe('Getting object metadata', () => {
        describe('When an object exists', () => {
            it('should return the object metadata', async () => {
                const mockStat = {
                    metaData: {
                        'content-type': 'image/png',
                    },
                };

                mockObjectStore.resolvedValues.getHeadObject = mockStat;

                const result = await bucketStore.getHeadObject('test-image.png');

                expect(mockObjectStore.calls.getHeadObject[0]).toEqual(['test-image.png']);
                expect(result).toEqual(mockStat);
            });
        });

        describe('When an object does not exist', () => {
            it('should throw the error', async () => {
                mockObjectStore.rejectedErrors.getHeadObject = { code: 'NotFound' } as any;

                await expect(bucketStore.getHeadObject('non-existent.png')).rejects.toEqual({
                    code: 'NotFound',
                });
            });
        });

        describe('When an error occurs', () => {
            it('should throw the error', async () => {
                mockObjectStore.rejectedErrors.getHeadObject = new Error('Access denied');

                await expect(bucketStore.getHeadObject('test-image.png')).rejects.toThrow('Access denied');
            });
        });
    });

    describe('Getting object stream', () => {
        describe('When getting an object stream', () => {
            it('should return a readable stream', async () => {
                const mockStream = {
                    pipe: () => {},
                    on: () => {},
                };

                mockObjectStore.resolvedValues.getObjectStream = mockStream;

                const result = await bucketStore.getObjectStream('test-image.png');

                expect(mockObjectStore.calls.getObjectStream[0]).toEqual(['test-image.png']);
                expect(result).toBe(mockStream);
            });
        });
    });

    describe('Uploading objects', () => {
        describe('When uploading an object with options', () => {
            it('should upload the object successfully', async () => {
                const mockBuffer = Buffer.from('test-data');
                const options = { contentType: 'image/png' };

                mockObjectStore.resolvedValues.putObject = undefined;

                await bucketStore.putObject('test-image.png', mockBuffer, options);

                expect(mockObjectStore.calls.putObject[0]).toEqual(['test-image.png', mockBuffer, options]);
            });
        });

        describe('When uploading an object without options', () => {
            it('should upload the object successfully', async () => {
                const mockBuffer = Buffer.from('test-data');

                mockObjectStore.resolvedValues.putObject = undefined;

                await bucketStore.putObject('test-image.png', mockBuffer);

                expect(mockObjectStore.calls.putObject[0]).toEqual(['test-image.png', mockBuffer, undefined]);
            });
        });

        describe('When upload fails', () => {
            it('should throw the error', async () => {
                const mockBuffer = Buffer.from('test-data');

                mockObjectStore.rejectedErrors.putObject = new Error('Upload failed');

                await expect(bucketStore.putObject('test-image.png', mockBuffer)).rejects.toThrow('Upload failed');
            });
        });

        describe('When working without logger', () => {
            it('should work without logger', async () => {
                mockObjectStore.reset();
                const storeWithoutLogger = new BucketStore(mockConnection);
                const mockBuffer = Buffer.from('test-data');

                mockObjectStore.resolvedValues.putObject = undefined;

                await storeWithoutLogger.putObject('test-image.png', mockBuffer);

                expect(mockObjectStore.calls.putObject[0]).toEqual(['test-image.png', mockBuffer, undefined]);
            });
        });
    });
});
