import { withImageExtension } from '../../infrastructure/objectKey';
import type { ImageStore } from '../ImageService/types';

const readAll = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

    return Buffer.concat(chunks);
};

/**
 * Copies an object to a new key of its own, so neither side's lifecycle can break the other: a published cover must
 * survive its private recipe changing it, and a personal copy must survive the library recipe being unpublished.
 * Returns the new key (with the extension its content type implies).
 */
export const copyImage = async (store: ImageStore, fromKey: string, toKeyBase: string): Promise<string> => {
    const head = await store.getHeadObject(fromKey);
    const contentType = head?.metaData?.['content-type'] ?? 'image/webp';
    const buffer = await readAll(await store.getObjectStream(fromKey));
    const toKey = withImageExtension(toKeyBase, contentType);
    await store.putObject(toKey, buffer, { contentType });

    return toKey;
};
