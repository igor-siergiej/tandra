import type { Logger } from '@imapps/api-utils';
import { APIError } from '@imapps/api-utils/hono';
import type { DiscoverySearchQuery, DiscoverySource, RecipeDifficulty } from '@tandra/types';
import type { Context } from 'hono';
import { z } from 'zod';

import type { DiscoveryCopyService } from '../../domain/DiscoveryCopyService';
import type { DiscoveryModerationService } from '../../domain/DiscoveryModeration';
import type { DiscoveryPublishService } from '../../domain/DiscoveryPublish';
import type { DiscoveryService } from '../../domain/DiscoveryService';
import { caughtErrorSchema } from '../../infrastructure/caughtError';
import { type HonoVars, readLenientJsonBody, withAuth } from '../handlerUtils';

const DIFFICULTIES: readonly RecipeDifficulty[] = ['easy', 'medium', 'hard'];
const SOURCES: readonly DiscoverySource[] = ['wikibooks', 'user'];

const publishBodySchema = z
    .object({
        agreeToLicence: z.boolean().optional().catch(undefined),
        showName: z.boolean().optional().catch(undefined),
    })
    .catch({});

const reportBodySchema = z.object({ reason: z.string().optional().catch(undefined) }).catch({});

const badRequest = (message: string) => new APIError(message, 400);

/**
 * `?tags=a&tags=b` and `?tags=a,b` both work; blanks are dropped. Free-text values such as ingredient names can
 * themselves contain commas ("onion, chopped"), so those are repeated-parameter only.
 */
const listParam = (c: Context<HonoVars>, name: string, splitCommas = true): string[] | undefined => {
    const values = c.req
        .queries(name)
        ?.flatMap((v) => (splitCommas ? v.split(',') : [v]))
        .map((v) => v.trim())
        .filter(Boolean);

    return values?.length ? values : undefined;
};

// Parse + two bound checks for one parameter.
// fallow-ignore-next-line complexity
const intParam = (c: Context<HonoVars>, name: string, min: number): number | undefined => {
    const raw = c.req.query(name);

    if (raw === undefined || raw === '') return undefined;
    const value = Number(raw);

    if (!Number.isInteger(value) || value < min) throw badRequest(`${name} must be an integer >= ${min}`);

    return value;
};

const enumParam = <T extends string>(c: Context<HonoVars>, name: string, allowed: readonly T[]): T[] | undefined => {
    const values = listParam(c, name);
    const isAllowed = (value: string): value is T => allowed.some((candidate) => candidate === value);
    const invalid = values?.find((v) => !isAllowed(v));

    if (invalid) throw badRequest(`${name} must be one of: ${allowed.join(', ')}`);

    return values?.filter(isAllowed);
};

const parseSearchQuery = (c: Context<HonoVars>): DiscoverySearchQuery => ({
    q: c.req.query('q'),
    tags: listParam(c, 'tags'),
    ingredients: listParam(c, 'ingredients', false),
    difficulty: enumParam(c, 'difficulty', DIFFICULTIES),
    source: enumParam(c, 'source', SOURCES),
    minTime: intParam(c, 'minTime', 0),
    maxTime: intParam(c, 'maxTime', 0),
    page: intParam(c, 'page', 1),
    pageSize: intParam(c, 'pageSize', 1),
});

/** Errors carrying a 4xx/503 status are meant for the caller; anything else is hidden behind a generic 500. */
// Status mapping for one error path.
// fallow-ignore-next-line complexity
const failWith = (logger: Logger, message: string, cause: unknown): never => {
    const e = caughtErrorSchema.parse(cause);
    const status = e.status ?? 500;
    logger.error(message, { error: e.message, status });
    throw new APIError(status === 500 ? 'Internal Server Error' : (e.message ?? 'Internal Server Error'), status);
};

// Search and lookups read only the shared library and never expose personal recipes or their `users`.
export interface DiscoveryHandlerServices {
    discovery: DiscoveryService;
    copy: DiscoveryCopyService;
    publish: DiscoveryPublishService;
    moderation: DiscoveryModerationService;
}

export const createDiscoveryHandlers = (
    { discovery: service, copy: copyService, publish: publishService, moderation }: DiscoveryHandlerServices,
    logger: Logger
) => ({
    searchRecipes: async (c: Context<HonoVars>): Promise<Response> => {
        const query = parseSearchQuery(c);

        try {
            return c.json(await service.search(query), 200);
        } catch (error) {
            return failWith(logger, 'API: Discovery search failed', error);
        }
    },

    getRecipe: async (c: Context<HonoVars>): Promise<Response> => {
        try {
            return c.json(await service.getRecipe(c.req.param('id') ?? ''), 200);
        } catch (error) {
            return failWith(logger, 'API: Discovery recipe lookup failed', error);
        }
    },

    getSimilarRecipes: async (c: Context<HonoVars>): Promise<Response> => {
        const limit = intParam(c, 'limit', 1);

        try {
            return c.json(await service.getSimilar(c.req.param('id') ?? '', limit), 200);
        } catch (error) {
            return failWith(logger, 'API: Discovery similar-recipes lookup failed', error);
        }
    },

    // The one write: it creates a recipe in the CALLER's own collection and only reads the library.
    copyRecipe: withAuth(async (c, user) => {
        try {
            return c.json(await copyService.copyToPersonal(c.req.param('id') ?? '', user), 201);
        } catch (error) {
            return failWith(logger, 'API: Discovery recipe copy failed', error);
        }
    }),

    // Publishing is owner-only (checked in the service) and writes a snapshot; the private recipe is never exposed.
    publishRecipe: withAuth(async (c, user) => {
        const body = await readLenientJsonBody(c, publishBodySchema);

        try {
            return c.json(await publishService.publish(c.req.param('recipeId') ?? '', user, body), 201);
        } catch (error) {
            return failWith(logger, 'API: Recipe publish failed', error);
        }
    }),

    unpublishRecipe: withAuth(async (c, user) => {
        try {
            await publishService.unpublish(c.req.param('id') ?? '', user);

            return c.body(null, 204);
        } catch (error) {
            return failWith(logger, 'API: Recipe unpublish failed', error);
        }
    }),

    listPublished: withAuth(async (c, user) => {
        try {
            return c.json(await publishService.listMine(user), 200);
        } catch (error) {
            return failWith(logger, 'API: Listing published recipes failed', error);
        }
    }),

    reportRecipe: withAuth(async (c, user) => {
        const { reason } = await readLenientJsonBody(c, reportBodySchema);

        try {
            await moderation.report(c.req.param('id') ?? '', user, reason);

            return c.body(null, 204);
        } catch (error) {
            return failWith(logger, 'API: Recipe report failed', error);
        }
    }),

    listReports: withAuth(async (c, user) => {
        try {
            return c.json(await moderation.listReports(user), 200);
        } catch (error) {
            return failWith(logger, 'API: Listing reports failed', error);
        }
    }),

    delistRecipe: withAuth(async (c, user) => {
        try {
            await moderation.delist(c.req.param('id') ?? '', user);

            return c.body(null, 204);
        } catch (error) {
            return failWith(logger, 'API: Recipe delist failed', error);
        }
    }),
});
