import { afterEach, describe, expect, it, vi } from 'bun:test';

import { stubFetch } from '../../testing/doubles';
import { HttpImageFetcher } from './index';

const resolveHost = async () => [{ address: '93.184.216.34' }];

describe('HttpImageFetcher', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('returns the image bytes and content type on success', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        stubFetch(
            vi.fn().mockResolvedValue(new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } }))
        );

        const fetcher = new HttpImageFetcher({ resolveHost });
        const result = await fetcher.fetchImage('https://example.com/cover.jpg');

        expect(result.contentType).toBe('image/jpeg');
        expect(Buffer.from(result.buffer)).toEqual(Buffer.from(bytes));
    });

    it('throws a 415 when the response is not an image', async () => {
        stubFetch(
            vi
                .fn()
                .mockResolvedValue(
                    new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
                )
        );

        const fetcher = new HttpImageFetcher({ resolveHost });
        await expect(fetcher.fetchImage('https://example.com/not-an-image')).rejects.toMatchObject({ status: 415 });
    });

    it('throws a 502 when the fetch itself fails', async () => {
        stubFetch(vi.fn().mockRejectedValue(new Error('network down')));

        const fetcher = new HttpImageFetcher({ resolveHost });
        await expect(fetcher.fetchImage('https://example.com/cover.jpg')).rejects.toMatchObject({ status: 502 });
    });

    it('throws a 502 when the upstream responds with a non-ok status', async () => {
        stubFetch(vi.fn().mockResolvedValue(new Response('', { status: 404 })));

        const fetcher = new HttpImageFetcher({ resolveHost });
        await expect(fetcher.fetchImage('https://example.com/missing.jpg')).rejects.toMatchObject({ status: 502 });
    });

    it('throws a 413 when the image exceeds the byte cap', async () => {
        const huge = new Uint8Array(20);
        stubFetch(
            vi.fn().mockResolvedValue(new Response(huge, { status: 200, headers: { 'content-type': 'image/png' } }))
        );

        const fetcher = new HttpImageFetcher({ maxBytes: 10, resolveHost });
        await expect(fetcher.fetchImage('https://example.com/huge.png')).rejects.toMatchObject({ status: 413 });
    });
});
