import { Client } from 'minio';

import type { ObjectEraser } from '../../domain/AccountService';

export interface BucketEraserSettings {
    /** `host` or `host:port`, as in BUCKET_ENDPOINT. */
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucketName: string;
}

/**
 * Lists and removes objects in the bucket. The shared `ObjectStoreConnection` can only read and write, so this keeps a
 * client of its own for the one flow that has to delete (account erasure); it does not connect until it is used.
 */
export class BucketEraser implements ObjectEraser {
    private readonly client: Client;
    private readonly bucketName: string;

    constructor({ endpoint, accessKey, secretKey, bucketName }: BucketEraserSettings) {
        const [endPoint, port] = endpoint.split(':');
        this.client = new Client({
            endPoint,
            port: port ? Number.parseInt(port, 10) : undefined,
            useSSL: false,
            accessKey,
            secretKey,
        });
        this.bucketName = bucketName;
    }

    async listKeys(prefix: string): Promise<string[]> {
        const keys: string[] = [];

        for await (const item of this.client.listObjectsV2(this.bucketName, prefix, true)) {
            if (item.name) keys.push(item.name);
        }

        return keys;
    }

    async removeKeys(keys: string[]): Promise<void> {
        if (keys.length === 0) return;

        // Removing a key that is already gone is not an error, so a repeated erasure is harmless.
        const failures = await this.client.removeObjects(this.bucketName, keys);

        if (failures.length > 0) {
            throw new Error(`Could not remove ${failures.length} of ${keys.length} objects from the bucket`);
        }
    }
}
