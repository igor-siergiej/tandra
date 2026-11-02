import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchSession } from './fetchSession';
import { sessionCache } from './sessionCache';

const respond = (status: number, body: unknown) =>
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(body), { status }))
    );

describe('fetchSession', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.unstubAllGlobals());

    it('uses the display username and remembers the user for offline launches', async () => {
        respond(200, { session: {}, user: { id: 'u1', username: 'igor', displayUsername: 'Igor' } });

        expect(await fetchSession()).toEqual({ user: { id: 'u1', username: 'Igor' }, needsUsername: false });
        expect(sessionCache.read()).toEqual({ id: 'u1', username: 'Igor' });
    });

    it('keeps the cached user when the network is down', async () => {
        sessionCache.write({ id: 'u1', username: 'Igor' });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        expect(await fetchSession()).toEqual({ user: { id: 'u1', username: 'Igor' }, needsUsername: false });
    });

    it.each([502, 429])('keeps the cached user through a %i', async (status) => {
        sessionCache.write({ id: 'u1', username: 'Igor' });
        respond(status, {});

        expect((await fetchSession()).user).toEqual({ id: 'u1', username: 'Igor' });
    });

    it.each([
        ['a null session', 200, null],
        ['a 401', 401, { error: 'unauthorized' }],
    ])('signs out and forgets the cached user on %s', async (_label, status, body) => {
        sessionCache.write({ id: 'u1', username: 'Igor' });
        respond(status, body);

        expect(await fetchSession()).toEqual({ user: null, needsUsername: false });
        expect(sessionCache.read()).toBeNull();
    });

    it('flags a signed-in user who has not picked a username yet', async () => {
        respond(200, { session: {}, user: { id: 'g1', username: null, displayUsername: null } });

        expect(await fetchSession()).toEqual({ user: null, needsUsername: true });
    });
});
