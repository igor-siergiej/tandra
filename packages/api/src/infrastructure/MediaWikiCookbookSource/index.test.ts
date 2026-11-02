import { describe, expect, it, vi } from 'bun:test';

import { MediaWikiCookbookSource } from './index';

const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

const setup = (responses: Array<Response | Error>) => {
    const queue = [...responses];
    const calls: URL[] = [];
    const headers: Array<Record<string, string>> = [];

    const fetchImpl = vi.fn(async (input: URL | string, init?: RequestInit) => {
        calls.push(new URL(String(input)));
        headers.push(init?.headers as Record<string, string>);
        const next = queue.shift();

        if (next instanceof Error) throw next;

        if (!next) throw new Error('unexpected request');

        return next;
    });

    const sleep = vi.fn(async (_ms: number) => {});
    const source = new MediaWikiCookbookSource(undefined, { fetchImpl: fetchImpl as never, sleep, minIntervalMs: 250 });

    return { source, calls, headers, sleep };
};

const listPage = (pages: Array<[number, string, number]>, cont?: Record<string, string>) =>
    json({
        ...(cont && { continue: cont }),
        query: {
            pages: pages.map(([pageid, title, revid]) => ({ pageid, title, revisions: [{ revid }] })),
        },
    });

describe('MediaWikiCookbookSource', () => {
    it('lists recipe pages across continuation batches, de-duplicated, with their revisions', async () => {
        const { source, calls } = setup([
            listPage([[1, 'Cookbook:A', 10]], { geicontinue: '102|2', continue: 'gei||' }),
            listPage([
                [1, 'Cookbook:A', 10],
                [2, 'Cookbook:B', 20],
            ]),
        ]);

        const pages = await source.listRecipePages();

        expect(pages).toEqual([
            { pageId: 1, title: 'Cookbook:A', revisionId: 10 },
            { pageId: 2, title: 'Cookbook:B', revisionId: 20 },
        ]);
        expect(calls[0]?.searchParams.get('geititle')).toBe('Template:Recipe');
        expect(calls[0]?.searchParams.get('geinamespace')).toBe('102');
        // The second request must carry the continuation token from the first.
        expect(calls[1]?.searchParams.get('geicontinue')).toBe('102|2');
    });

    it('identifies itself, asks to be shed under replica lag and paces every request', async () => {
        const { source, calls, headers, sleep } = setup([listPage([])]);

        await source.listRecipePages();

        expect(headers[0]?.['User-Agent']).toContain('Tandra');
        expect(calls[0]?.searchParams.get('maxlag')).toBe('5');
        expect(sleep).toHaveBeenCalledWith(250);
    });

    it('backs off for Retry-After on 429 and on maxlag, then succeeds', async () => {
        const { source, sleep } = setup([
            new Response('slow down', { status: 429, headers: { 'retry-after': '7' } }),
            json(
                { error: { code: 'maxlag', info: 'Waiting for a database server' } },
                { headers: { 'retry-after': '3' } }
            ),
            listPage([[1, 'Cookbook:A', 10]]),
        ]);

        const pages = await source.listRecipePages();

        expect(pages).toHaveLength(1);
        expect(sleep).toHaveBeenCalledWith(7000);
        expect(sleep).toHaveBeenCalledWith(3000);
    });

    it('throws rather than returning a partial listing when the API keeps failing', async () => {
        const { source } = setup(Array.from({ length: 4 }, () => new Response('down', { status: 503 })));
        await expect(source.listRecipePages()).rejects.toThrow('gave up');
    });

    it('fetches content in batches of 50 and omits a batch that fails instead of throwing', async () => {
        const refs = Array.from({ length: 60 }, (_, i) => ({
            pageId: i + 1,
            title: `Cookbook:R${i + 1}`,
            revisionId: 1,
        }));

        const { source, calls } = setup([
            json({
                query: {
                    pages: refs.slice(0, 50).map((r) => ({
                        pageid: r.pageId,
                        title: r.title,
                        revisions: [{ revid: 5, slots: { main: { content: `text ${r.pageId}` } } }],
                    })),
                },
            }),
            new Response('boom', { status: 500 }),
            new Response('boom', { status: 500 }),
            new Response('boom', { status: 500 }),
            new Response('boom', { status: 500 }),
        ]);

        const pages = await source.fetchPages(refs);

        expect(pages).toHaveLength(50);
        expect(pages[0]).toEqual({ pageId: 1, title: 'Cookbook:R1', revisionId: 5, wikitext: 'text 1' });
        expect(calls[0]?.searchParams.get('pageids')?.split('|')).toHaveLength(50);
        expect(calls[1]?.searchParams.get('pageids')?.split('|')).toHaveLength(10);
    });

    describe('pictures', () => {
        const imagePage = (title: string, extra: Record<string, unknown> = {}) => ({
            title,
            missing: true,
            known: true,
            imageinfo: [
                {
                    thumburl: `https://upload.wikimedia.org/thumb/${title.replace(/ /g, '_')}`,
                    mime: 'image/jpeg',
                    descriptionurl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, '_')}`,
                    extmetadata: {
                        LicenseShortName: { value: 'CC BY-SA 4.0' },
                        Restrictions: { value: '' },
                        Artist: { value: '<a href="//x">Jane</a>' },
                    },
                },
            ],
            ...extra,
        });

        it('reads licence, credit and rendition per file and asks for a 640px copy', async () => {
            const { source, calls } = setup([json({ query: { pages: [imagePage('File:Baked Ziti.jpg')] } })]);

            const info = await source.fetchImageInfo(['Baked Ziti.jpg']);

            expect(info.get('Baked Ziti.jpg')).toEqual({
                found: true,
                mime: 'image/jpeg',
                thumbUrl: 'https://upload.wikimedia.org/thumb/File:Baked_Ziti.jpg',
                descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Baked_Ziti.jpg',
                licenceShortName: 'CC BY-SA 4.0',
                restrictions: '',
                artistHtml: '<a href="//x">Jane</a>',
            });
            expect(calls[0]?.searchParams.get('iiurlwidth')).toBe('640');
            expect(calls[0]?.searchParams.get('titles')).toBe('File:Baked Ziti.jpg');
        });

        it('matches a name to its page through title normalisation and redirects', async () => {
            const { source } = setup([
                json({
                    query: {
                        normalized: [{ from: 'File:baked_Ziti.jpg', to: 'File:Baked Ziti.jpg' }],
                        redirects: [{ from: 'File:Baked Ziti.jpg', to: 'File:Ziti, baked.jpg' }],
                        pages: [imagePage('File:Ziti, baked.jpg')],
                    },
                }),
            ]);

            const info = await source.fetchImageInfo(['baked_Ziti.jpg']);

            expect(info.get('baked_Ziti.jpg')?.found).toBe(true);
        });

        it('says "not found" for a file the wiki does not have, which is different from a failed lookup', async () => {
            const { source } = setup([json({ query: { pages: [{ title: 'File:Nope.jpg', missing: true }] } })]);

            const info = await source.fetchImageInfo(['Nope.jpg']);

            expect(info.get('Nope.jpg')).toEqual({ found: false });
        });

        it('leaves names out of the result when the lookup fails, so they are tried again later', async () => {
            const { source } = setup(Array.from({ length: 4 }, () => new Response('down', { status: 503 })));

            const info = await source.fetchImageInfo(['Baked Ziti.jpg']);

            expect(info.size).toBe(0);
        });

        it('downloads a picture with the same User-Agent, and reports its type', async () => {
            const { source, headers } = setup([
                new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg; charset=x' } }),
            ]);

            const image = await source.downloadImage('https://upload.wikimedia.org/x.jpg');

            expect(image).toEqual({ buffer: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' });
            expect(headers[0]?.['User-Agent']).toContain('Tandra');
        });

        it('backs off on 429 and gives up after a few attempts', async () => {
            const ok = setup([
                new Response('slow', { status: 429, headers: { 'retry-after': '2' } }),
                new Response(new Uint8Array([9]), { headers: { 'content-type': 'image/png' } }),
            ]);

            expect((await ok.source.downloadImage('https://x/y.png')).contentType).toBe('image/png');
            expect(ok.sleep).toHaveBeenCalledWith(2000);

            const bad = setup(Array.from({ length: 4 }, () => new Response('slow', { status: 429 })));
            await expect(bad.source.downloadImage('https://x/y.png')).rejects.toThrow('gave up');
        });

        it('fails on a missing picture and on one that is too large', async () => {
            const missing = setup([new Response('nope', { status: 404 })]);
            await expect(missing.source.downloadImage('https://x/y.jpg')).rejects.toThrow('HTTP 404');

            const huge = setup([new Response(new Uint8Array(5 * 1024 * 1024 + 1))]);
            await expect(huge.source.downloadImage('https://x/y.jpg')).rejects.toThrow('too large');
        });

        it('never has two wiki requests in flight at once, whoever asks', async () => {
            let inFlight = 0;
            let peak = 0;

            const fetchImpl = vi.fn(async () => {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 5));
                inFlight -= 1;

                return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } });
            });

            const source = new MediaWikiCookbookSource(undefined, {
                fetchImpl: fetchImpl as never,
                sleep: async () => {},
                minIntervalMs: 0,
            });

            await Promise.all([1, 2, 3, 4].map(() => source.downloadImage('https://x/y.jpg')));

            expect(fetchImpl).toHaveBeenCalledTimes(4);
            expect(peak).toBe(1);
        });
    });
});
