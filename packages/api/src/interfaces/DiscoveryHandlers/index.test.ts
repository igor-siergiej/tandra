import { describe, expect, it, vi } from 'bun:test';

import { errorHandler } from '@imapps/api-utils/hono';
import type { DiscoveryRecipe } from '@tandra/types';
import { Hono } from 'hono';

import type { DiscoveryCopyService } from '../../domain/DiscoveryCopyService';
import { DiscoveryService } from '../../domain/DiscoveryService';
import type { DiscoveryIndex } from '../../domain/DiscoveryService/types';
import { MongoDiscoveryRecipeRepository } from '../../infrastructure/MongoDiscoveryRecipeRepository';
import type { HonoVars } from '../handlerUtils';
import { createDiscoveryHandlers } from './index';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const appFor = (
    service: DiscoveryService,
    copyService: DiscoveryCopyService = {} as never,
    extra: { publish?: unknown; moderation?: unknown } = {}
) => {
    const handlers = createDiscoveryHandlers(
        {
            discovery: service,
            copy: copyService,
            publish: (extra.publish ?? {}) as never,
            moderation: (extra.moderation ?? {}) as never,
        },
        logger as never
    );
    const app = new Hono<HonoVars>();
    app.onError(errorHandler);
    app.get('/api/discover/recipes', handlers.searchRecipes as never);
    app.get('/api/discover/recipes/:id/similar', handlers.getSimilarRecipes as never);
    app.get('/api/discover/recipes/:id', handlers.getRecipe as never);
    const asUser = async (
        c: { req: { header: (name: string) => string | undefined }; set: (k: 'user', v: unknown) => void },
        next: () => Promise<void>
    ) => {
        const id = c.req.header('x-test-user');
        if (id) c.set('user', { id, username: id });
        await next();
    };
    app.post('/api/recipes/:recipeId/publish', asUser as never, handlers.publishRecipe as never);
    app.delete('/api/discover/published/:id', asUser as never, handlers.unpublishRecipe as never);
    app.get('/api/discover/published', asUser as never, handlers.listPublished as never);
    app.post('/api/discover/recipes/:id/report', asUser as never, handlers.reportRecipe as never);
    app.delete('/api/discover/recipes/:id', asUser as never, handlers.delistRecipe as never);
    app.get('/api/discover/reports', asUser as never, handlers.listReports as never);
    // Auth middleware stand-in: `X-Test-User` names the authenticated user, absent means unauthenticated.
    app.post(
        '/api/discover/recipes/:id/copy',
        async (c, next) => {
            const id = c.req.header('x-test-user');
            if (id) c.set('user', { id, username: id });
            await next();
        },
        handlers.copyRecipe as never
    );
    return app;
};

const emptyResult = {
    hits: [],
    total: 0,
    page: 1,
    pageSize: 20,
    facets: { tags: [], difficulty: [], source: [], ingredients: [], time: [] },
};

const libraryRecipe = (id: string): DiscoveryRecipe => ({
    id,
    title: `Library ${id}`,
    ingredients: [],
    instructions: [],
    tags: [],
    source: 'wikibooks',
    sourceUrl: 'https://example.test',
    licence: 'CC-BY-SA-4.0',
    attribution: 'Wikibooks contributors',
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

const fakeIndex = (overrides: Partial<DiscoveryIndex> = {}): DiscoveryIndex => ({
    ensureIndex: vi.fn(),
    index: vi.fn(),
    remove: vi.fn(),
    search: vi.fn(async () => emptyResult),
    similar: vi.fn(async () => []),
    rebuild: vi.fn(),
    ...overrides,
});

/** A Mongo double holding BOTH the private recipe collection and the library, recording which were touched. */
const fakeDb = (collections: Record<string, Array<Record<string, unknown>>>) => {
    const touched: string[] = [];
    return {
        touched,
        getCollection: (name: string) => {
            touched.push(name);
            return {
                findOne: async (filter: { id: string }) => collections[name]?.find((d) => d.id === filter.id) ?? null,
            };
        },
    };
};

describe('GET /api/discover/recipes', () => {
    it('parses repeated and comma-separated lists, numbers and enums into the search query', async () => {
        const index = fakeIndex();
        const app = appFor(new DiscoveryService({} as never, index));

        const res = await app.request(
            '/api/discover/recipes?q=soup&tags=vegan,quick&tags=easy&ingredients=olive%20oil&difficulty=easy,hard&source=user&minTime=10&maxTime=60&page=2&pageSize=5'
        );

        expect(res.status).toBe(200);
        expect(index.search).toHaveBeenCalledWith({
            q: 'soup',
            tags: ['vegan', 'quick', 'easy'],
            ingredients: ['olive oil'],
            difficulty: ['easy', 'hard'],
            source: ['user'],
            minTime: 10,
            maxTime: 60,
            page: 2,
            pageSize: 5,
        });
    });

    it('keeps a comma inside an ingredient name instead of splitting it into two filters', async () => {
        const index = fakeIndex();
        const app = appFor(new DiscoveryService({} as never, index));

        await app.request('/api/discover/recipes?ingredients=onion%2C%20chopped&ingredients=salt');

        expect(index.search).toHaveBeenCalledWith(expect.objectContaining({ ingredients: ['onion, chopped', 'salt'] }));
    });

    it.each([
        ['difficulty=impossible'],
        ['source=martian'],
        ['page=0'],
        ['page=abc'],
        ['pageSize=1.5'],
        ['minTime=-1'],
    ])('rejects a malformed query (%s) with 400 without calling the index', async (qs) => {
        const index = fakeIndex();
        const res = await appFor(new DiscoveryService({} as never, index)).request(`/api/discover/recipes?${qs}`);
        expect(res.status).toBe(400);
        expect(index.search).not.toHaveBeenCalled();
    });

    it('returns 503 with a clear message when the search engine is unreachable', async () => {
        const index = fakeIndex({
            search: vi
                .fn()
                .mockRejectedValue(
                    Object.assign(new Error('Recipe discovery is temporarily unavailable'), { status: 503 })
                ),
        });
        const res = await appFor(new DiscoveryService({} as never, index)).request('/api/discover/recipes?q=soup');
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: 'Recipe discovery is temporarily unavailable' });
    });

    it('hides the message of an unexpected failure behind a generic 500', async () => {
        const index = fakeIndex({ search: vi.fn().mockRejectedValue(new Error('cluster password is hunter2')) });
        const res = await appFor(new DiscoveryService({} as never, index)).request('/api/discover/recipes');
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });
});

describe('library recipe endpoints', () => {
    it('returns a library recipe without Mongo bookkeeping', async () => {
        const db = fakeDb({ discoveryRecipes: [libraryRecipe('lib-1')] });
        const service = new DiscoveryService(new MongoDiscoveryRecipeRepository(db as never), fakeIndex());
        const res = await appFor(service).request('/api/discover/recipes/lib-1');
        expect(res.status).toBe(200);
        expect(((await res.json()) as DiscoveryRecipe).title).toBe('Library lib-1');
    });

    it('404s similar-recipes for an unknown recipe and passes the limit through for a known one', async () => {
        const index = fakeIndex();
        const db = fakeDb({ discoveryRecipes: [libraryRecipe('lib-1')] });
        const app = appFor(new DiscoveryService(new MongoDiscoveryRecipeRepository(db as never), index));

        expect((await app.request('/api/discover/recipes/none/similar')).status).toBe(404);
        expect((await app.request('/api/discover/recipes/lib-1/similar?limit=3')).status).toBe(200);
        expect(index.similar).toHaveBeenCalledWith('lib-1', 3);
    });

    it('never exposes a private personal recipe, even when asked for its exact id', async () => {
        const db = fakeDb({
            recipe: [
                { id: 'private-1', title: 'Grandma secret', users: [{ id: 'u1', username: 'alice' }], ownerId: 'u1' },
            ],
            discoveryRecipes: [libraryRecipe('lib-1')],
        });
        const index = fakeIndex();
        const app = appFor(new DiscoveryService(new MongoDiscoveryRecipeRepository(db as never), index));

        const direct = await app.request('/api/discover/recipes/private-1');
        const similar = await app.request('/api/discover/recipes/private-1/similar');

        expect(direct.status).toBe(404);
        expect(similar.status).toBe(404);
        expect(await direct.text()).not.toContain('Grandma');
        expect(index.similar).not.toHaveBeenCalled();
        // The discovery path read the library collection and nothing else.
        expect(new Set(db.touched)).toEqual(new Set(['discoveryRecipes']));
    });
});

describe('POST /api/discover/recipes/:id/copy', () => {
    const copyService = (impl: (id: string, user: unknown) => Promise<unknown>) =>
        ({ copyToPersonal: vi.fn(impl) }) as unknown as DiscoveryCopyService;

    it('creates the copy for the authenticated user and answers 201 with the new recipe', async () => {
        const copy = copyService(async (id, user) => ({ id: 'personal-1', title: `from ${id}`, owner: user }));
        const app = appFor(new DiscoveryService({} as never, fakeIndex()), copy);

        const res = await app.request('/api/discover/recipes/lib-1/copy', {
            method: 'POST',
            headers: { 'x-test-user': 'u-me' },
        });

        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({ id: 'personal-1', owner: { id: 'u-me' } });
        expect(copy.copyToPersonal).toHaveBeenCalledWith('lib-1', { id: 'u-me', username: 'u-me' });
    });

    it('rejects an unauthenticated caller without copying anything', async () => {
        const copy = copyService(async () => ({}));
        const app = appFor(new DiscoveryService({} as never, fakeIndex()), copy);

        const res = await app.request('/api/discover/recipes/lib-1/copy', { method: 'POST' });

        expect(res.status).toBe(401);
        expect(copy.copyToPersonal).not.toHaveBeenCalled();
    });

    it('surfaces a duplicate as 409 with its message', async () => {
        const copy = copyService(async () => {
            throw Object.assign(new Error('This recipe is already in your recipes'), { status: 409 });
        });
        const res = await appFor(new DiscoveryService({} as never, fakeIndex()), copy).request(
            '/api/discover/recipes/lib-1/copy',
            { method: 'POST', headers: { 'x-test-user': 'u-me' } }
        );
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'This recipe is already in your recipes' });
    });
});

describe('publish, moderation and published-list endpoints', () => {
    const service = () => new DiscoveryService({} as never, fakeIndex());
    const headers = { 'x-test-user': 'u-me', 'content-type': 'application/json' };

    it.each([
        ['POST', '/api/recipes/r1/publish'],
        ['DELETE', '/api/discover/published/user-1'],
        ['GET', '/api/discover/published'],
        ['POST', '/api/discover/recipes/user-1/report'],
        ['DELETE', '/api/discover/recipes/user-1'],
        ['GET', '/api/discover/reports'],
    ])('rejects an unauthenticated %s %s with 401 before touching any service', async (method, path) => {
        const boom = new Proxy(
            {},
            {
                get: () => () => {
                    throw new Error('service must not be called');
                },
            }
        );
        const res = await appFor(service(), {} as never, { publish: boom, moderation: boom }).request(path, { method });
        expect(res.status).toBe(401);
    });

    it('publishes with the body the user sent and answers 201', async () => {
        const publish = {
            publish: vi.fn(async () => ({ recipeId: 'r1', libraryId: 'user-1', publishedAt: new Date(0) })),
        };
        const res = await appFor(service(), {} as never, { publish }).request('/api/recipes/r1/publish', {
            method: 'POST',
            headers,
            body: JSON.stringify({ agreeToLicence: true, showName: true }),
        });

        expect(res.status).toBe(201);
        expect(publish.publish).toHaveBeenCalledWith(
            'r1',
            { id: 'u-me', username: 'u-me' },
            { agreeToLicence: true, showName: true }
        );
        expect(await res.json()).toMatchObject({ libraryId: 'user-1' });
    });

    it('treats a missing or malformed body as "no agreement", not a crash', async () => {
        const publish = {
            publish: vi.fn(async (_id: string, _user: unknown, body: { agreeToLicence?: boolean }) => {
                if (body.agreeToLicence !== true) throw Object.assign(new Error('You must agree'), { status: 400 });
                return {};
            }),
        };
        const res = await appFor(service(), {} as never, { publish }).request('/api/recipes/r1/publish', {
            method: 'POST',
            headers,
            body: 'not json',
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'You must agree' });
    });

    it('surfaces the imported-recipe refusal and a duplicate with their own statuses', async () => {
        const make = (status: number, message: string) => ({
            publish: vi.fn(async () => {
                throw Object.assign(new Error(message), { status });
            }),
        });
        const imported = await appFor(service(), {} as never, { publish: make(422, "can't be made public") }).request(
            '/api/recipes/r1/publish',
            { method: 'POST', headers, body: JSON.stringify({ agreeToLicence: true }) }
        );
        const duplicate = await appFor(service(), {} as never, {
            publish: make(409, 'already in the library'),
        }).request('/api/recipes/r1/publish', {
            method: 'POST',
            headers,
            body: JSON.stringify({ agreeToLicence: true }),
        });
        expect(imported.status).toBe(422);
        expect(duplicate.status).toBe(409);
    });

    it('answers 204 for unpublish and report, passing the id, the user and the reason', async () => {
        const publish = { unpublish: vi.fn(async () => {}) };
        const moderation = { report: vi.fn(async () => {}) };
        const app = appFor(service(), {} as never, { publish, moderation });

        const un = await app.request('/api/discover/published/user-1', { method: 'DELETE', headers });
        const rep = await app.request('/api/discover/recipes/user-1/report', {
            method: 'POST',
            headers,
            body: JSON.stringify({ reason: 'spam' }),
        });

        expect([un.status, rep.status]).toEqual([204, 204]);
        expect(publish.unpublish).toHaveBeenCalledWith('user-1', { id: 'u-me', username: 'u-me' });
        expect(moderation.report).toHaveBeenCalledWith('user-1', { id: 'u-me', username: 'u-me' }, 'spam');
    });

    it('ignores a non-string report reason', async () => {
        const moderation = { report: vi.fn(async () => {}) };
        await appFor(service(), {} as never, { moderation }).request('/api/discover/recipes/user-1/report', {
            method: 'POST',
            headers,
            body: JSON.stringify({ reason: { evil: true } }),
        });
        expect(moderation.report).toHaveBeenCalledWith('user-1', expect.anything(), undefined);
    });

    it('answers a non-admin delist and report listing with 403', async () => {
        const forbidden = async () => {
            throw Object.assign(new Error('Admin access required'), { status: 403 });
        };
        const moderation = { delist: vi.fn(forbidden), listReports: vi.fn(forbidden) };
        const app = appFor(service(), {} as never, { moderation });

        const delist = await app.request('/api/discover/recipes/user-1', { method: 'DELETE', headers });
        const list = await app.request('/api/discover/reports', { headers });

        expect([delist.status, list.status]).toEqual([403, 403]);
    });

    it("lists the caller's published recipes", async () => {
        const publish = { listMine: vi.fn(async () => [{ recipeId: 'r1', libraryId: 'user-1' }]) };
        const res = await appFor(service(), {} as never, { publish }).request('/api/discover/published', { headers });
        expect(await res.json()).toEqual([{ recipeId: 'r1', libraryId: 'user-1' }]);
    });
});
