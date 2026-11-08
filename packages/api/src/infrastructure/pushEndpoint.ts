import { assertPublicUrl, type HostLookup } from './safeFetch';

const MAX_ENDPOINT_LENGTH = 2048;

const invalid = () => Object.assign(new Error('Invalid push subscription endpoint'), { status: 400 });

/**
 * A push endpoint is a URL the api later POSTs to on its own, so it gets the same treatment as any other
 * server-side fetch target: https only, and never a private or reserved address.
 */
export const assertPushEndpoint = async (endpoint: string, resolveHost?: HostLookup): Promise<void> => {
    if (endpoint.length > MAX_ENDPOINT_LENGTH) throw invalid();
    let parsed: URL;
    try {
        parsed = new URL(endpoint);
    } catch {
        throw invalid();
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw invalid();
    try {
        await assertPublicUrl(endpoint, resolveHost);
    } catch {
        throw invalid();
    }
};
