import type { Context, Next } from 'hono';

import { config } from '../config';

const DEFAULT_ALLOWED_ORIGINS = ['https://tandra.uk', 'http://localhost:4000', 'http://localhost:5173'];

const parseOrigins = (raw: string | undefined): string[] => {
    if (!raw) return DEFAULT_ALLOWED_ORIGINS;

    return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const ALLOWED_ORIGINS = parseOrigins(config.get('publicDiscoverOrigins'));

const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

/**
 * CORS for the read-only /api/public/discover/* endpoints. Allows GET only
 * with a small allow-list of headers; Access-Control-Allow-Origin is echoed
 * for any origin the operator has whitelisted, or `*` when the env var is
 * unset (so the selfhost compose works with the default localhost origin).
 */
// fallow-ignore-next-line complexity
export const publicDiscoverCors = async (c: Context, next: Next): Promise<void> => {
    const requestOrigin = c.req.header('origin');

    if (requestOrigin) {
        const allowAll = !config.get('publicDiscoverOrigins');
        const allowed = allowAll || ALLOWED_ORIGINS.includes(requestOrigin);

        if (allowed) {
            c.res.headers.set('Access-Control-Allow-Origin', allowAll ? '*' : requestOrigin);
            c.res.headers.set('Vary', 'Origin');
            c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            c.res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
            c.res.headers.set('Access-Control-Max-Age', '600');
        }
    }

    if (c.req.method === 'OPTIONS') {
        c.res = new Response(null, { status: 204, headers: c.res.headers });

        return;
    }

    await next();
};
