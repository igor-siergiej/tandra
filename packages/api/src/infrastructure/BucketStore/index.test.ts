import { beforeEach, describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';

import type { ObjectStoreConnection } from '@imapps/api-utils';

import { fake } from '../../testing/fake';
import { BucketStore } from './index';

type Bucket = Pick<ObjectStoreConnection, 'getHeadObject' | 'getObjectStream' | 'putObject'>;

type HeadObject = Awaited<ReturnType<Bucket['getHeadObject']>>;

type BucketCalls = {
    getHeadObject: Array<Parameters<Bucket['getHeadObject']>>;
    getObjectStream: Array<Parameters<Bucket['getObjectStream']>>;
    putObject: Array<Parameters<Bucket['putObject']>>;
};

type BucketFailures = { getHeadObject?: Error; getObjectStream?: Error; putObject?: Error };

const noCalls = (): BucketCalls => ({ getHeadObject: [], getObjectStream: [], putObject: [] });

/** Records each call and answers with the value or error a test sets. */
class MockObjectStore implements Bucket {
    calls = noCalls();

    headObject: HeadObject = fake({});

    stream = Readable.from([]);

    rejectedErrors: BucketFailures = {};

    getHeadObject = async (...args: Parameters<Bucket['getHeadObject']>) => {
        this.calls.getHeadObject.push(args);

        if (this.rejectedErrors.getHeadObject) throw this.rejectedErrors.getHeadObject;

        return this.headObject;
    };

    getObjectStream = async (...args: Parameters<Bucket['getObjectStream']>) => {
        this.calls.getObjectStream.push(args);

        if (this.rejectedErrors.getObjectStream) throw this.rejectedErrors.getObjectStream;

        return this.stream;
    };

    putObject = async (...args: Parameters<Bucket['putObject']>) => {
        this.calls.putObject.push(args);

        if (this.rejectedErrors.putObject) throw this.rejectedErrors.putObject;
    };

    reset() {
        this.calls = noCalls();
        this.headObject = fake({});
        this.stream = Readable.from([]);
        this.rejectedErrors = {};
    }
}

const mockObjectStore = new MockObjectStore();
const mockConnection = fake<ObjectStoreConnection>(mockObjectStore);

describe('BucketStore', () => {
    let bucketStore: BucketStore;

    beforeEach(() => {
        mockObjectStore.reset();
        bucketStore = new BucketStore(mockConnection);
    });

    describe('Getting object metadata', () => {
        describe('When an object exists', () => {
            it('should return the object metadata', async () => {
                const mockStat: HeadObject = fake({ metaData: { 'content-type': 'image/png' } });

                mockObjectStore.headObject = mockStat;

                const result = await bucketStore.getHeadObject('test-image.png');

                expect(mockObjectStore.calls.getHeadObject[0]).toEqual(['test-image.png']);
                expect(result).toEqual(mockStat);
            });
        });

        describe('When an object does not exist', () => {
            it('should throw the error', async () => {
                mockObjectStore.rejectedErrors.getHeadObject = Object.assign(new Error('Not found'), {
                    code: 'NotFound',
                });

                await expect(bucketStore.getHeadObject('non-existent.png')).rejects.toMatchObject({
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
                const mockStream = Readable.from(['bytes']);

                mockObjectStore.stream = mockStream;

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

                await bucketStore.putObject('test-image.png', mockBuffer, options);

                expect(mockObjectStore.calls.putObject[0]).toEqual(['test-image.png', mockBuffer, options]);
            });
        });

        describe('When uploading an object without options', () => {
            it('should upload the object successfully', async () => {
                const mockBuffer = Buffer.from('test-data');

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

                await storeWithoutLogger.putObject('test-image.png', mockBuffer);

                expect(mockObjectStore.calls.putObject[0]).toEqual(['test-image.png', mockBuffer, undefined]);
            });
        });
    });
});
