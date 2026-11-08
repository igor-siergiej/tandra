import type { PageFetcher } from '../../domain/RecipeImportService/types';
import { guardedFetch, type HostLookup } from '../safeFetch';

export interface HttpPageFetcherOptions {
    timeoutMs?: number;
    maxBytes?: number;
    userAgent?: string;
    resolveHost?: HostLookup;
}

// Firefox, not Chrome: several recipe sites run WAF rules that specifically flag the extremely
// common "generic Chrome" UA string used by countless scraping tools/headless browsers, while a
// Firefox UA (much less commonly spoofed) passes through the same bot checks unblocked.
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0';

export class HttpPageFetcher implements PageFetcher {
    private readonly timeoutMs: number;
    private readonly maxBytes: number;
    private readonly userAgent: string;
    private readonly resolveHost?: HostLookup;

    constructor(options: HttpPageFetcherOptions = {}) {
        this.timeoutMs = options.timeoutMs ?? 8000;
        this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
        this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
        this.resolveHost = options.resolveHost;
    }

    async fetchPage(url: string): Promise<string> {
        const headers = {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        };

        return guardedFetch(
            url,
            { headers },
            { timeoutMs: this.timeoutMs, noun: 'page', resolveHost: this.resolveHost },
            (response) => this.handleResponse(response)
        );
    }

    // fallow-ignore-next-line complexity
    private async handleResponse(response: Response): Promise<string> {
        if (!response.ok) {
            if (response.status === 403 || response.status === 999) {
                throw Object.assign(
                    new Error('This site blocks automated requests — paste the ingredients/instructions manually'),
                    { status: 502 }
                );
            }

            throw Object.assign(new Error(`Failed to fetch page: ${response.status}`), { status: 502 });
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (contentType && !contentType.includes('html') && !contentType.includes('xml')) {
            throw Object.assign(new Error(`Unsupported content type: ${contentType}`), { status: 415 });
        }

        return await this.readCapped(response);
    }

    // Stream the body and stop once maxBytes is reached, so a huge page can't exhaust memory.
    private async readCapped(response: Response): Promise<string> {
        const body = response.body;

        if (!body) {
            const text = await response.text();

            return text.slice(0, this.maxBytes);
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let received = 0;
        let html = '';

        while (received < this.maxBytes) {
            const { done, value } = await reader.read();

            if (done) break;
            received += value.byteLength;
            html += decoder.decode(value, { stream: true });
        }

        await reader.cancel().catch(() => {});
        html += decoder.decode();

        // A single chunk may overshoot the cap; enforce it on the final string too.
        return html.slice(0, this.maxBytes);
    }
}
