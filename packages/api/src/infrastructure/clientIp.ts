import { isPrivateIp } from './safeFetch';

/**
 * Resolve the nearest public address from the X-Forwarded-For chain, falling
 * back to X-Real-IP. Trusts the public hops and ignores private-IP entries
 * (LAN / docker bridge), so a malformed upstream header cannot impersonate
 * the LAN address.
 */
// fallow-ignore-next-line complexity
export const clientIpFrom = (forwardedFor: string | undefined, realIp: string | null): string => {
    const entries = (forwardedFor ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (entries.length === 0) return realIp ?? 'unknown';

    return [...entries].reverse().find((entry) => !isPrivateIp(entry)) ?? entries[entries.length - 1];
};
