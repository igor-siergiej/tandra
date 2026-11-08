import type { ImageFetcher } from '../../domain/RecipeImportService/types';
import { guardedFetch, type HostLookup } from '../safeFetch';

export interface HttpImageFetcherOptions {
    timeoutMs?: number;
    maxBytes?: number;
    userAgent?: string;
    resolveHost?: HostLookup;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0';

export class HttpImageFetcher implements ImageFetcher {
    private readonly timeoutMs: number;
    private readonly maxBytes: number;
    private readonly userAgent: string;
    private readonly resolveHost?: HostLookup;

    constructor(options: HttpImageFetcherOptions = {}) {
        this.timeoutMs = options.timeoutMs ?? 8000;
        this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
        this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
        this.resolveHost = options.resolveHost;
    }

    async fetchImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
        return guardedFetch(
            url,
            { headers: { 'User-Agent': this.userAgent, Accept: 'image/*' } },
            { timeoutMs: this.timeoutMs, noun: 'image', resolveHost: this.resolveHost },
            (response) => this.handleResponse(response)
        );
    }

    // fallow-ignore-next-line complexity
    private async handleResponse(response: Response): Promise<{ buffer: Buffer; contentType: string }> {
        if (!response.ok) {
            throw Object.assign(new Error(`Failed to fetch image: ${response.status}`), { status: 502 });
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (!contentType.startsWith('image/')) {
            throw Object.assign(new Error(`Unsupported content type: ${contentType || 'unknown'}`), { status: 415 });
        }

        return { buffer: await this.readCapped(response), contentType };
    }

    // Stream the body and bail as soon as the cap is crossed, so an oversized or endless body is never buffered whole.
    // fallow-ignore-next-line complexity
    private async readCapped(response: Response): Promise<Buffer> {
        const tooLarge = () => Object.assign(new Error('Image exceeds maximum allowed size'), { status: 413 });
        const declared = Number(response.headers.get('content-length'));

        if (declared > this.maxBytes) throw tooLarge();

        const reader = response.body?.getReader();

        if (!reader) return Buffer.alloc(0);

        const chunks: Array<Uint8Array> = [];
        let received = 0;

        for (;;) {
            const { done, value } = await reader.read();

            if (done) break;
            received += value.byteLength;

            if (received > this.maxBytes) {
                await reader.cancel().catch(() => {});
                throw tooLarge();
            }

            chunks.push(value);
        }

        return Buffer.concat(chunks);
    }
}
