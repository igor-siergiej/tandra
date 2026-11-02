import type { Logger } from '@imapps/api-utils';
import { z } from 'zod';

import type {
    WikibooksImageInfo,
    WikibooksPage,
    WikibooksPageRef,
    WikibooksSource,
} from '../../domain/WikibooksIngest/types';
import { caughtErrorSchema } from '../caughtError';

const API_URL = 'https://en.wikibooks.org/w/api.php';

/** Wikimedia asks API clients to identify themselves and a way to contact the operator. */
const DEFAULT_USER_AGENT = 'TandraRecipeIngest/1.0 (https://app.tandra.uk; igorsiergiej@gmail.com)';

/** Every Cookbook recipe page transcludes this template; the Cookbook namespace is 102. */
const RECIPE_TEMPLATE = 'Template:Recipe';
const COOKBOOK_NAMESPACE = '102';

/** `prop=revisions` with content is capped at 50 pages per request. */
const CONTENT_BATCH_SIZE = 50;
const LIST_BATCH_SIZE = 500;
const MAX_ATTEMPTS = 4;
const MAX_LAG_SECONDS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

/** `prop=imageinfo` takes up to 50 titles per request. */
const IMAGE_INFO_BATCH_SIZE = 50;

/** Pictures are shown at card/preview size; a larger rendition would only cost bandwidth and storage. */
const IMAGE_WIDTH_PX = 640;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MIN_INTERVAL_MS = 500;
const DEFAULT_RETRY_SECONDS = 5;
const MAX_RETRY_SECONDS = 60;

type Params = Record<string, string>;

// The wiki's answer is decoded leniently: any field that is missing or of another type reads as absent.
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const revisionSchema = z.object({
    revid: lenient(z.number()),
    slots: lenient(z.object({ main: lenient(z.object({ '*': lenient(z.string()), content: lenient(z.string()) })) })),
});

const metadataEntrySchema = z.object({ value: lenient(z.string()) });
const extMetadataSchema = z.record(z.string(), metadataEntrySchema.optional().catch(undefined));

const imageInfoSchema = z.object({
    url: lenient(z.string()),
    thumburl: lenient(z.string()),
    mime: lenient(z.string()),
    descriptionurl: lenient(z.string()),
    extmetadata: lenient(extMetadataSchema),
});

const pageSchema = z.object({
    pageid: lenient(z.number()),
    title: lenient(z.string()),
    missing: lenient(z.boolean()),
    /** Present on a file that lives on Commons: a "missing" local page is then not a missing file. */
    known: lenient(z.boolean()),
    revisions: lenient(z.array(revisionSchema)),
    imageinfo: lenient(z.array(imageInfoSchema)),
});

const titleMappingSchema = z.array(z.object({ from: z.string(), to: z.string() }));

const apiJsonSchema = z.object({
    error: lenient(z.object({ code: lenient(z.string()), info: lenient(z.string()) })),
    continue: lenient(z.record(z.string(), z.string())),
    query: lenient(
        z.object({
            pages: lenient(z.union([z.record(z.string(), pageSchema), z.array(pageSchema)])),
            normalized: lenient(titleMappingSchema),
            redirects: lenient(titleMappingSchema),
        })
    ),
});

type PageJson = z.output<typeof pageSchema>;

type ExtMetadata = z.output<typeof extMetadataSchema>;

type ApiJson = z.output<typeof apiJsonSchema>;

export interface MediaWikiCookbookSourceOptions {
    userAgent?: string;
    minIntervalMs?: number;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const metadata = (meta: ExtMetadata | undefined, key: string): string | undefined => meta?.[key]?.value;

// A Commons file has no local page, so the wiki marks the page `missing` but `known`; only unknown+missing is absent.
// One optional field per piece of image metadata.
// fallow-ignore-next-line complexity
const toImageInfo = (page: PageJson): WikibooksImageInfo => {
    const info = page.imageinfo?.[0];

    if (!info || (page.missing && !page.known)) return { found: false };

    return {
        found: true,
        mime: info.mime,
        thumbUrl: info.thumburl ?? info.url,
        descriptionUrl: info.descriptionurl,
        licenceShortName: metadata(info.extmetadata, 'LicenseShortName'),
        restrictions: metadata(info.extmetadata, 'Restrictions'),
        artistHtml: metadata(info.extmetadata, 'Artist'),
    };
};

const asPages = (json: ApiJson): PageJson[] => {
    const pages = json.query?.pages;

    if (!pages) return [];

    return Array.isArray(pages) ? pages : Object.values(pages);
};

/**
 * The English Wikibooks Cookbook over the MediaWiki Action API. Requests are strictly serial with a pause between
 * them, send a descriptive User-Agent and `maxlag`, and back off on 429/5xx/maxlag, per Wikimedia API etiquette.
 */
export class MediaWikiCookbookSource implements WikibooksSource {
    private readonly userAgent: string;
    private readonly minIntervalMs: number;
    private readonly fetchImpl: typeof fetch;
    private readonly sleep: (ms: number) => Promise<void>;
    private tail: Promise<void> = Promise.resolve();

    // Option defaults, one line each.
    // fallow-ignore-next-line complexity
    constructor(
        private readonly logger?: Logger,
        options: MediaWikiCookbookSourceOptions = {}
    ) {
        this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
        this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.sleep = options.sleep ?? defaultSleep;
    }

    // Paging loop plus one guarded field-by-field read per page.
    // fallow-ignore-next-line complexity
    async listRecipePages(): Promise<WikibooksPageRef[]> {
        const pages = new Map<number, WikibooksPageRef>();
        let cursor: Params = {};

        do {
            const json = await this.request({
                action: 'query',
                generator: 'embeddedin',
                geititle: RECIPE_TEMPLATE,
                geinamespace: COOKBOOK_NAMESPACE,
                geilimit: String(LIST_BATCH_SIZE),
                prop: 'revisions',
                rvprop: 'ids',
                ...cursor,
            });

            for (const page of asPages(json)) {
                const revisionId = page.revisions?.[0]?.revid;

                if (page.pageid !== undefined && page.title && revisionId !== undefined) {
                    pages.set(page.pageid, { pageId: page.pageid, title: page.title, revisionId });
                }
            }

            cursor = json.continue ?? {};
        } while (Object.keys(cursor).length > 0);

        return [...pages.values()];
    }

    // Batch loop with per-batch failure isolation and a guarded read per page.
    // fallow-ignore-next-line complexity
    async fetchPages(refs: WikibooksPageRef[]): Promise<WikibooksPage[]> {
        const fetched: WikibooksPage[] = [];

        for (let i = 0; i < refs.length; i += CONTENT_BATCH_SIZE) {
            const batch = refs.slice(i, i + CONTENT_BATCH_SIZE);

            try {
                const json = await this.request({
                    action: 'query',
                    prop: 'revisions',
                    rvprop: 'ids|content',
                    rvslots: 'main',
                    pageids: batch.map((ref) => ref.pageId).join('|'),
                });

                for (const page of asPages(json)) {
                    const revision = page.revisions?.[0];
                    const wikitext = revision?.slots?.main?.content ?? revision?.slots?.main?.['*'];

                    if (page.pageid !== undefined && page.title && revision?.revid !== undefined && wikitext) {
                        fetched.push({
                            pageId: page.pageid,
                            title: page.title,
                            revisionId: revision.revid,
                            wikitext,
                        });
                    }
                }
            } catch (error) {
                // One lost batch must not end the run: its pages are absent from the result and so retried next run.
                this.logger?.warn('Wikibooks content batch failed', {
                    pages: batch.length,
                    error: caughtErrorSchema.parse(error).message,
                });
            }
        }

        return fetched;
    }

    // Batch loop, then each requested name is matched to its page through MediaWiki's title normalisation/redirects.
    // fallow-ignore-next-line complexity
    async fetchImageInfo(filenames: string[]): Promise<Map<string, WikibooksImageInfo>> {
        const result = new Map<string, WikibooksImageInfo>();
        const unique = [...new Set(filenames)];

        for (let i = 0; i < unique.length; i += IMAGE_INFO_BATCH_SIZE) {
            const batch = unique.slice(i, i + IMAGE_INFO_BATCH_SIZE);

            try {
                const json = await this.request({
                    action: 'query',
                    prop: 'imageinfo',
                    iiprop: 'url|mime|extmetadata',
                    iiurlwidth: String(IMAGE_WIDTH_PX),
                    redirects: '1',
                    titles: batch.map((name) => `File:${name}`).join('|'),
                });

                const byTitle = new Map(asPages(json).map((page) => [page.title, page]));

                // Title normalisation, then at most one redirect.
                // fallow-ignore-next-line complexity
                const hop = (title: string): string => {
                    const normalised = json.query?.normalized?.find((n) => n.from === title)?.to ?? title;

                    return json.query?.redirects?.find((r) => r.from === normalised)?.to ?? normalised;
                };

                for (const name of batch) {
                    const page = byTitle.get(hop(`File:${name}`));

                    if (page) result.set(name, toImageInfo(page));
                }
            } catch (error) {
                // A lost batch is simply absent from the result: those pictures are looked up again next run.
                this.logger?.warn('Wikibooks image info batch failed', {
                    files: batch.length,
                    error: caughtErrorSchema.parse(error).message,
                });
            }
        }

        return result;
    }

    downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
        return this.serial(() => this.downloadNow(url));
    }

    // Same pacing and User-Agent as API requests, retry on 429/5xx, and a size cap so a bad file cannot fill memory.
    // fallow-ignore-next-line complexity
    private async downloadNow(url: string): Promise<{ buffer: Buffer; contentType: string }> {
        for (let attempt = 1; ; attempt += 1) {
            await this.sleep(this.minIntervalMs);

            const response = await this.fetchImpl(url, {
                headers: { 'User-Agent': this.userAgent, Accept: 'image/*' },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (response.status === 429 || response.status >= 500) {
                if (attempt >= MAX_ATTEMPTS) throw new Error(`Image download: HTTP ${response.status} (gave up)`);

                const wait = Math.min(
                    Number(response.headers.get('retry-after')) || DEFAULT_RETRY_SECONDS,
                    MAX_RETRY_SECONDS
                );

                await this.sleep(wait * 1000);
                continue;
            }

            if (!response.ok) throw new Error(`Image download: HTTP ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());

            if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`Image download: ${buffer.length} bytes is too large`);

            return { buffer, contentType: response.headers.get('content-type')?.split(';')[0]?.trim() ?? '' };
        }
    }

    /** One wiki request at a time, in call order, whoever asks: the pacing above is only polite if nothing overlaps. */
    private serial<T>(work: () => Promise<T>): Promise<T> {
        const run = this.tail.then(work);
        this.tail = run.then(
            () => undefined,
            () => undefined
        );

        return run;
    }

    private request(params: Params): Promise<ApiJson> {
        return this.serial(() => this.requestNow(params));
    }

    // Retry loop: pacing, outcome check, bounded attempts.
    // fallow-ignore-next-line complexity
    private async requestNow(params: Params): Promise<ApiJson> {
        const url = new URL(API_URL);
        const query = { format: 'json', formatversion: '2', maxlag: String(MAX_LAG_SECONDS), ...params };

        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

        for (let attempt = 1; ; attempt += 1) {
            await this.sleep(this.minIntervalMs);
            const outcome = await this.send(url);

            if ('json' in outcome) return outcome.json;

            if (attempt >= MAX_ATTEMPTS)
                throw new Error(`Wikibooks API: ${outcome.reason} (gave up after ${attempt} attempts)`);
            await this.sleep(outcome.retryAfterSeconds * 1000);
        }
    }

    // One request: status classes, maxlag and error body, timeout; each is a distinct outcome.
    // fallow-ignore-next-line complexity
    private async send(url: URL): Promise<{ json: ApiJson } | { reason: string; retryAfterSeconds: number }> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await this.fetchImpl(url, {
                signal: controller.signal,
                headers: { 'User-Agent': this.userAgent, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
            });

            const retryAfter = Math.min(
                Number(response.headers.get('retry-after')) || DEFAULT_RETRY_SECONDS,
                MAX_RETRY_SECONDS
            );

            if (response.status === 429 || response.status >= 500) {
                return { reason: `HTTP ${response.status}`, retryAfterSeconds: retryAfter };
            }

            if (!response.ok) throw new Error(`Wikibooks API: HTTP ${response.status}`);

            const json = apiJsonSchema.parse(await response.json());

            if (json.error?.code === 'maxlag') return { reason: 'replica lag (maxlag)', retryAfterSeconds: retryAfter };

            if (json.error) throw new Error(`Wikibooks API error ${json.error.code}: ${json.error.info}`);

            return { json };
        } catch (error) {
            if (caughtErrorSchema.parse(error).name === 'AbortError') {
                return { reason: 'request timed out', retryAfterSeconds: DEFAULT_RETRY_SECONDS };
            }

            throw error;
        } finally {
            clearTimeout(timer);
        }
    }
}
