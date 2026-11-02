import { afterEach, describe, expect, it } from 'bun:test';

import { HttpPageFetcher } from './index';

const resolveHost = async () => [{ address: '93.184.216.34' }];

const originalFetch = globalThis.fetch;

const stubFetch = (impl: typeof fetch) => {
    globalThis.fetch = impl as typeof fetch;
};

describe('HttpPageFetcher', () => {
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns the HTML body and sends a realistic User-Agent', async () => {
        let sentHeaders: Headers | undefined;
        stubFetch(async (_url, init) => {
            sentHeaders = new Headers(init?.headers);

            return new Response('<html><body>ok</body></html>', {
                headers: { 'content-type': 'text/html; charset=utf-8' },
            });
        });

        const html = await new HttpPageFetcher({ resolveHost }).fetchPage('https://example.com');

        expect(html).toContain('<body>ok</body>');
        expect(sentHeaders?.get('user-agent')).toContain('Mozilla/5.0');
    });

    it('throws a 502 on a non-ok response', async () => {
        stubFetch(async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }));

        await expect(new HttpPageFetcher({ resolveHost }).fetchPage('https://example.com')).rejects.toMatchObject({
            status: 502,
        });
    });

    it('throws a clear message when the target site blocks the request with a 403', async () => {
        stubFetch(async () => new Response('forbidden', { status: 403, headers: { 'content-type': 'text/html' } }));

        await expect(new HttpPageFetcher({ resolveHost }).fetchPage('https://example.com')).rejects.toMatchObject({
            status: 502,
            message: expect.stringContaining('blocks automated requests'),
        });
    });

    it('throws 415 on a non-html content type', async () => {
        stubFetch(async () => new Response('{}', { headers: { 'content-type': 'application/json' } }));

        await expect(new HttpPageFetcher({ resolveHost }).fetchPage('https://example.com')).rejects.toMatchObject({
            status: 415,
        });
    });

    it('throws a 502 when the fetch itself fails', async () => {
        stubFetch(async () => {
            throw new Error('network down');
        });

        await expect(new HttpPageFetcher({ resolveHost }).fetchPage('https://example.com')).rejects.toMatchObject({
            status: 502,
        });
    });

    it('caps the body at maxBytes', async () => {
        const big = 'x'.repeat(50);
        stubFetch(async () => new Response(big, { headers: { 'content-type': 'text/html' } }));

        const html = await new HttpPageFetcher({ maxBytes: 10, resolveHost }).fetchPage('https://example.com');

        expect(html.length).toBeLessThanOrEqual(10);
    });
});
