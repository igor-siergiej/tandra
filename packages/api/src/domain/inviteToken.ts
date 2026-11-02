/**
 * Invite-link tokens. Single-list, single-use (per token, until expiry), revocable,
 * expiring. The token IS the lookup key — no JWT signing, no opaque server-side
 * mapping. 32 random bytes, base64url-encoded, gives 256 bits of entropy; that
 * is far past anything guessable in a human lifetime.
 */

const TOKEN_BYTES = 32;

const randomBytes = (size: number): Uint8Array => {
    const out = new Uint8Array(size);
    // Web Crypto is available in Bun; crypto.getRandomValues is the only
    // safe source for a secret token. Reject anything else rather than fall
    // back to a weaker source.
    crypto.getRandomValues(out);

    return out;
};

const base64UrlEncode = (bytes: Uint8Array): string => {
    let bin = '';

    for (const byte of bytes) bin += String.fromCharCode(byte);
    const b64 = btoa(bin);

    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

/** A new opaque invite token. The string is safe to put in a URL path. */
export const generateInviteToken = (): string => base64UrlEncode(randomBytes(TOKEN_BYTES));

/** Default invite lifetime. The card body calls for an expiring token; 7 days
 *  matches what the friendship flow already uses. */
export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
