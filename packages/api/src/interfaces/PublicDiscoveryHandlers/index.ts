import type { Logger } from '@imapps/api-utils';
import { APIError } from '@imapps/api-utils/hono';
import type {
    DiscoveryRecipe,
    PublicDiscoveryRecipe,
    PublicDiscoveryRecipePage,
    PublicDiscoveryRecipeSummary,
} from '@tandra/types';
import type { Context } from 'hono';

import type { DiscoveryService } from '../../domain/DiscoveryService';
import { clientIpFrom } from '../../infrastructure/clientIp';
import { IpRateLimiter, type RateLimitDecision } from '../../infrastructure/rateLimit';
import type { HonoVars } from '../handlerUtils';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

// Crawl-friendly cap: the public list backs the future marketing site, so
// per-IP burst limits are tighter than /api/health but looser than AI routes.
const RATE_LIMIT_PER_WINDOW = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimiter = new IpRateLimiter(RATE_LIMIT_PER_WINDOW);

setInterval(() => rateLimiter.reset(), RATE_LIMIT_WINDOW_MS).unref();

const clientIp = (c: Context): string =>
    clientIpFrom(c.req.header('x-forwarded-for'), c.req.raw.headers.get('x-real-ip'));

const isRateLimitError = (error: unknown): error is RateLimitDecision => {
    return typeof error === 'object' && error !== null && 'allowed' in error && 'retryAfterSeconds' in error;
};

const requireRateLimit = (c: Context): void => {
    const ip = clientIp(c);

    if (!rateLimiter.isAllowed(ip)) {
        const decision: RateLimitDecision = {
            allowed: false,
            retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        };

        throw new APIError('Too many requests', 429, { 'Retry-After': String(decision.retryAfterSeconds) });
    }
};

/** Strip everything the public list/page should not carry: Mongo _id, internal flags, reporter metadata. */
// fallow-ignore-next-line complexity
const toPublicSummary = (recipe: DiscoveryRecipe): PublicDiscoveryRecipeSummary => {
    const out: PublicDiscoveryRecipeSummary = {
        id: recipe.id,
        title: recipe.title,
        tags: [...recipe.tags],
        source: recipe.source,
        sourceUrl: recipe.sourceUrl,
        licence: recipe.licence,
        attribution: recipe.attribution,
    };

    if (recipe.slug !== undefined) out.slug = recipe.slug;

    if (recipe.prepTime !== undefined) out.prepTime = recipe.prepTime;

    if (recipe.cookTime !== undefined) out.cookTime = recipe.cookTime;

    if (recipe.servings !== undefined) out.servings = recipe.servings;

    if (recipe.difficulty !== undefined) out.difficulty = recipe.difficulty;

    if (recipe.coverImageKey !== undefined) out.coverImageKey = recipe.coverImageKey;

    if (recipe.publishedBy !== undefined) out.publishedBy = recipe.publishedBy;

    return out;
};

const toPublicRecipe = (recipe: DiscoveryRecipe): PublicDiscoveryRecipe => ({
    ...toPublicSummary(recipe),
    ingredients: recipe.ingredients,
    instructions: [...recipe.instructions],
    ...(recipe.coverImageAttribution !== undefined && { coverImageAttribution: recipe.coverImageAttribution }),
    ...(recipe.coverImageSourceUrl !== undefined && { coverImageSourceUrl: recipe.coverImageSourceUrl }),
});

const parseCursor = (value: string | undefined): string | null => {
    if (!value) return null;

    // Cursor is the ObjectId of the last item on the previous page. We
    // accept hex (24 chars) and reject everything else; an invalid cursor
    // starts a fresh page rather than 500ing the caller.
    if (!/^[0-9a-f]{24}$/i.test(value)) return null;

    return value;
};

const parsePageSize = (value: string | undefined): number => {
    if (!value) return DEFAULT_PAGE_SIZE;
    const n = Math.trunc(Number(value));

    if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;

    return Math.min(n, MAX_PAGE_SIZE);
};

export interface PublicDiscoveryHandlerServices {
    discovery: DiscoveryService;
}

export const createPublicDiscoveryHandlers = ({ discovery }: PublicDiscoveryHandlerServices, logger: Logger) => ({
    // fallow-ignore-next-line complexity
    list: async (c: Context<HonoVars>): Promise<Response> => {
        try {
            requireRateLimit(c);
            const pageSize = parsePageSize(c.req.query('pageSize'));
            const cursor = parseCursor(c.req.query('cursor'));
            const page = await discovery.listPublic(pageSize, cursor);

            const lastId = (
                page.at(-1) as (DiscoveryRecipe & { _id?: { toString(): string } }) | undefined
            )?._id?.toString();

            const response: PublicDiscoveryRecipePage = {
                items: page.map(toPublicSummary),
                ...(lastId && page.length === pageSize ? { nextCursor: lastId } : {}),
            };

            return c.json(response, 200);
        } catch (error) {
            if (isRateLimitError(error)) {
                return c.json({ error: 'rate_limited' }, 429, { 'Retry-After': String(error.retryAfterSeconds) });
            }

            logger.error('Public discovery list failed', { error: (error as Error).message });

            return c.json({ error: 'internal' }, 500);
        }
    },

    // fallow-ignore-next-line complexity
    bySlug: async (c: Context<HonoVars>): Promise<Response> => {
        try {
            requireRateLimit(c);
            const slug = c.req.param('slug') ?? '';

            if (!slug) return c.json({ error: 'missing_slug' }, 400);
            const recipe = await discovery.getBySlug(slug);

            if (!recipe) return c.json({ error: 'not_found' }, 404);

            return c.json(toPublicRecipe(recipe), 200);
        } catch (error) {
            if (isRateLimitError(error)) {
                return c.json({ error: 'rate_limited' }, 429, { 'Retry-After': String(error.retryAfterSeconds) });
            }

            logger.error('Public discovery by-slug lookup failed', { error: (error as Error).message });

            return c.json({ error: 'internal' }, 500);
        }
    },
});
