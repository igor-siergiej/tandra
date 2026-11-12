import type { Logger } from '@imapps/api-utils';
import { APIError } from '@imapps/api-utils/hono';

import type { IssuedInvite, ListInvitePublic, ListInviteService } from '../../domain/ListInviteService';
import { clientIpFrom } from '../../infrastructure/clientIp';
import { IpRateLimiter } from '../../infrastructure/rateLimit';
import { withAuth } from '../handlerUtils';

const DEFAULT_TTL_DAYS = 7;
const MAX_TTL_DAYS = 30;

// The unauthenticated preview is the only public surface and the only one
// abusable by a single IP; bound it so a brute-force scan of the 256-bit
// token space does not get unlimited tries. 200/min is generous for a real
// user clicking the link from multiple devices.
const PREVIEW_RATE_LIMIT = 200;
const PREVIEW_RATE_WINDOW_MS = 60_000;
const previewLimiter = new IpRateLimiter(PREVIEW_RATE_LIMIT);

setInterval(() => previewLimiter.reset(), PREVIEW_RATE_WINDOW_MS).unref();

const clampTtl = (raw: unknown): number => {
    const days = Number(raw);

    if (!Number.isFinite(days) || days < 1) return DEFAULT_TTL_DAYS;

    return Math.min(Math.trunc(days), MAX_TTL_DAYS);
};

export const createListInviteHandlers = (service: ListInviteService, _logger: Logger) => ({
    issue: withAuth(async (c, user) => {
        const listTitle = c.req.param('title') ?? '';

        if (!listTitle) throw new APIError('List title is required', 400);
        const ttlMs = clampTtl(c.req.query('ttlDays')) * 24 * 60 * 60 * 1000;
        const invite: IssuedInvite = await service.issue(listTitle, { id: user.id, username: user.username }, ttlMs);

        return c.json(invite, 201);
    }),

    revoke: withAuth(async (c, user) => {
        const token = c.req.param('token') ?? '';

        if (!token) throw new APIError('Token is required', 400);
        await service.revoke(token, { id: user.id, username: user.username });

        return c.body(null, 204);
    }),

    /**
     * Unauthenticated preview. Per-IP rate-limited so a single client cannot
     * brute-force the 256-bit token space.
     */
    // fallow-ignore-next-line complexity
    preview: async (c: {
        req: {
            param: (n: string) => string | undefined;
            header: (n: string) => string | undefined;
            raw: { headers: { get: (n: string) => string | null } };
        };
    }): Promise<Response> => {
        const token = c.req.param('token') ?? '';

        if (!token) throw new APIError('Token is required', 400);
        const ip = clientIpFrom(c.req.header('x-forwarded-for'), c.req.raw.headers.get('x-real-ip'));

        if (!previewLimiter.isAllowed(ip)) {
            c.res.headers.set('Retry-After', String(Math.ceil(PREVIEW_RATE_WINDOW_MS / 1000)));

            return c.json({ error: 'rate_limited' }, 429);
        }

        const preview = await service.preview(token);

        return c.json(preview, 200);
    },

    listMine: withAuth(async (c, user) => {
        const items: ListInvitePublic[] = await service.listOpenByOwner(user.id);

        return c.json({ items }, 200);
    }),

    claim: withAuth(async (c, user) => {
        const token = c.req.param('token') ?? '';

        if (!token) throw new APIError('Token is required', 400);
        const result = await service.claim(token, { id: user.id, username: user.username });

        return c.json(result, 200);
    }),
});
