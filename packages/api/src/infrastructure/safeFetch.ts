import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 5;

const blocked = (message: string) => Object.assign(new Error(message), { status: 400 });

const toInt = (ip: string): number => ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);

// [network, prefix length]: this-network, RFC1918, CGNAT, loopback, link-local, IETF/test/benchmark nets, multicast+reserved.
const PRIVATE_V4_RANGES: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
];

const isPrivateIpv4 = (ip: string): boolean => {
    const value = toInt(ip);

    return PRIVATE_V4_RANGES.some(
        ([network, bits]) => Math.floor(value / 2 ** (32 - bits)) === Math.floor(toInt(network) / 2 ** (32 - bits))
    );
};

// IPv4, IPv4-mapped IPv6 and the two blocked IPv6 prefixes in one check.
// fallow-ignore-next-line complexity
export const isPrivateIp = (ip: string): boolean => {
    if (isIP(ip) === 4) return isPrivateIpv4(ip);

    const v6 = ip.toLowerCase();

    if (v6 === '::' || v6 === '::1') return true;

    // IPv4-mapped (::ffff:a.b.c.d or ::ffff:hhhh:hhhh) must be judged by the embedded v4 address.
    const mapped = v6.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);

    if (mapped) {
        if (mapped[1]) return isPrivateIpv4(mapped[1]);
        const hi = Number.parseInt(mapped[2], 16);
        const lo = Number.parseInt(mapped[3], 16);

        return isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }

    const first = Number.parseInt(v6.split(':')[0] || '0', 16);

    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
};

export type HostLookup = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultLookup: HostLookup = (hostname) => lookup(hostname, { all: true });

// One linear validate/fetch flow; splitting it would scatter the single SSRF decision.
// fallow-ignore-next-line complexity, unused-export
export const assertPublicUrl = async (rawUrl: string, resolveHost: HostLookup = defaultLookup): Promise<void> => {
    let parsed: URL;

    try {
        parsed = new URL(rawUrl);
    } catch {
        throw blocked('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw blocked('URL must be http or https');
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    let addresses: Array<string>;

    if (isIP(host)) {
        addresses = [host];
    } else {
        try {
            addresses = (await resolveHost(host)).map((entry) => entry.address);
        } catch {
            throw blocked('Could not resolve host');
        }
    }

    if (addresses.length === 0 || addresses.some(isPrivateIp)) {
        throw blocked('URL points to a private or reserved address');
    }
};

/**
 * fetch() that refuses private/reserved targets, re-checking every redirect hop itself. The resolve-then-fetch gap
 * leaves a narrow DNS-rebinding window (Bun's fetch cannot pin the resolved address).
 */
// One linear validate/fetch flow; splitting it would scatter the single SSRF decision.
// fallow-ignore-next-line complexity, unused-export
export const safeFetch = async (
    url: string,
    init: RequestInit,
    options: { resolveHost?: HostLookup; fetchImpl?: typeof fetch } = {}
): Promise<Response> => {
    const doFetch = options.fetchImpl ?? fetch;
    let current = url;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertPublicUrl(current, options.resolveHost);
        const response = await doFetch(current, { ...init, redirect: 'manual' });

        const location = response.headers.get('location');

        if (response.status < 300 || response.status >= 400 || !location) {
            return response;
        }

        await response.body?.cancel().catch(() => {});
        current = new URL(location, current).toString();
    }

    throw Object.assign(new Error('Too many redirects'), { status: 502 });
};

export interface GuardedFetchOptions {
    timeoutMs: number;
    noun: string;
    resolveHost?: HostLookup;
}

/**
 * safeFetch under one deadline that also covers reading the body in `handle`. Errors that already carry an HTTP
 * status pass through; anything else becomes a 502 (or a timeout message) naming what was being fetched.
 */
// One linear validate/fetch flow; splitting it would scatter the single SSRF decision.
// fallow-ignore-next-line complexity
export const guardedFetch = async <T>(
    url: string,
    init: RequestInit,
    options: GuardedFetchOptions,
    handle: (response: Response) => Promise<T>
): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
        const response = await safeFetch(
            url,
            { ...init, signal: controller.signal },
            { resolveHost: options.resolveHost }
        );

        return await handle(response);
    } catch (error) {
        if (typeof (error as { status?: unknown })?.status === 'number') throw error;

        const message =
            (error as Error)?.name === 'AbortError'
                ? `Timed out fetching ${options.noun}`
                : `Failed to fetch ${options.noun}`;

        throw Object.assign(new Error(message), { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
};
