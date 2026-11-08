import { describe, expect, it, mock } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { DiscoveryRecipe } from '@tandra/types';
import { Hono } from 'hono';
import { z } from 'zod';

import type { DiscoveryService } from '../../domain/DiscoveryService';
import { fake } from '../../testing/fake';
import { createPublicDiscoveryHandlers } from './index';

type Vars = { Variables: { user: { id: string; username: string } } };

const noopLogger = fake<Logger>({
    info: () => {},
    warn: () => {},
    error: () => {},
});

const recipe = (over: Partial<DiscoveryRecipe> = {}): DiscoveryRecipe => ({
    id: 'user-1',
    title: 'Grandma Soup',
    ingredients: [{ id: 'a', name: 'Carrot' }],
    instructions: ['Chop.'],
    tags: ['soup'],
    source: 'user',
    sourceUrl: 'https://example.test/discover/user-1',
    licence: 'CC-BY-SA-4.0',
    attribution: 'someone',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    slug: 'grandma-soup',
    ...over,
});

/** A library recipe as listPublic reads it: with the Mongo `_id` the handler issues cursors from. */
const withObjectId = (id: string, objectId: string) =>
    Object.assign(recipe({ id }), { _id: { toString: () => objectId } });

/** The public list response, decoded so a test reads typed fields. */
const listBody = z.object({
    items: z.array(z.looseObject({ id: z.string() })),
    nextCursor: z.string().optional(),
});

const makeApp = (discovery: Partial<DiscoveryService>) => {
    const app = new Hono<Vars>();
    const handlers = createPublicDiscoveryHandlers({ discovery: fake(discovery) }, noopLogger);
    app.get('/api/public/discover/recipes', (c) => handlers.list(c));
    app.get('/api/public/discover/recipes/:slug', (c) => handlers.bySlug(c));

    return app;
};

describe('PublicDiscoveryHandlers.list', () => {
    it('returns 200 with public items and a nextCursor when more pages exist', async () => {
        const list = mock(async () => [
            withObjectId('a', '507f1f77bcf86cd799439011'),
            withObjectId('b', '507f1f77bcf86cd799439012'),
        ]);

        const discovery: Partial<DiscoveryService> = { listPublic: list };
        const app = makeApp(discovery);
        const res = await app.request('/api/public/discover/recipes?pageSize=2');
        expect(res.status).toBe(200);
        const body = listBody.parse(await res.json());
        expect(body.items.map((i) => i.id)).toEqual(['a', 'b']);
        expect(body.items[0]).not.toHaveProperty('ownerId');
        expect(body.items[0]).not.toHaveProperty('users');
        expect(body.nextCursor).toBe('507f1f77bcf86cd799439012');
    });

    it('omits nextCursor when the page is short (last page)', async () => {
        const list = mock(async () => [withObjectId('a', '507f1f77bcf86cd799439011')]);

        const app = makeApp({ listPublic: list });
        const res = await app.request('/api/public/discover/recipes?pageSize=10');
        const body = listBody.parse(await res.json());
        expect(body.items).toHaveLength(1);
        expect(body.nextCursor).toBeUndefined();
    });

    it('rejects an invalid cursor and starts a fresh page', async () => {
        const list = mock(async (_pageSize: number, _after: string | null): Promise<DiscoveryRecipe[]> => []);
        const app = makeApp({ listPublic: list });
        const res = await app.request('/api/public/discover/recipes?cursor=not-a-real-id');
        expect(res.status).toBe(200);
        expect(list.mock.calls[0]?.[1]).toBeNull();
    });

    it('clamps pageSize to the documented max', async () => {
        const list = mock(async (_pageSize: number, _after: string | null): Promise<DiscoveryRecipe[]> => []);
        const app = makeApp({ listPublic: list });
        await app.request('/api/public/discover/recipes?pageSize=9999');
        expect(list.mock.calls[0]?.[0]).toBe(100);
    });
});

describe('PublicDiscoveryHandlers.bySlug', () => {
    it('returns the public projection for the slug', async () => {
        const getBySlug = mock(async () => recipe({ slug: 'pancakes' }));
        const app = makeApp({ getBySlug });
        const res = await app.request('/api/public/discover/recipes/pancakes');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ slug: 'pancakes', ingredients: [{ name: 'Carrot' }] });
        expect(body).not.toHaveProperty('ownerId');
    });

    it('returns 404 when the slug does not exist', async () => {
        const app = makeApp({ getBySlug: mock(async () => null) });
        const res = await app.request('/api/public/discover/recipes/missing');
        expect(res.status).toBe(404);
    });
});
