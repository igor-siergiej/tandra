import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { memoryAdapter } from 'better-auth/adapters/memory';
import type { Context } from 'hono';
import { z } from 'zod';

import { type Auth, createAuth } from '../infrastructure/BetterAuth';
import { fake, handlerContext } from '../testing/fake';
import { __setAuthGetterForTests, authenticate, optionalAuthenticate } from './auth';

type AuthVars = { Variables: { user: { id: string; username: string } } };

const createMockContext = (
    headers: Record<string, string> = {},
    requestHeaders: Record<string, string> = {}
): Context<AuthVars> => {
    const allHeaders = { ...headers, ...requestHeaders };

    const req = new Request('http://localhost/', {
        headers: allHeaders,
    });

    const ctx = handlerContext<Context<AuthVars>>({
        req: {
            header: (name: string) => allHeaders[name.toLowerCase()] ?? allHeaders[name],
            raw: req,
        },
        json: vi.fn().mockImplementation(
            (body, status) =>
                new Response(JSON.stringify(body), {
                    status,
                    headers: { 'Content-Type': 'application/json' },
                })
        ),
        set: vi.fn(),
        get: vi.fn(),
    });

    return ctx;
};

/** The part of a Better Auth sign-up response these tests read. */
const signUpBody = z.object({ user: z.object({ id: z.string() }) });

const mockNext = vi.fn().mockResolvedValue(undefined);

// Each test installs a fresh `memoryAdapter` Auth into the middleware via the test seam, signs a
// user up to mint a real session cookie, and drives `authenticate` with `Request`-shaped headers.
//
// The memory adapter is `better-auth/adapters/memory`; its deep-shape parameter and the
// `createAuth` factory parameter are structurally identical but the inference path treats
// them as unrelated. The named alias is what `fake` hands the adapter to.
type AuthDatabase = Parameters<typeof createAuth>[0]['database'];

describe('authenticate middleware with Better Auth session', () => {
    interface UserRow {
        id: string;
        username?: string;
        displayUsername?: string;
    }

    const buildAuth = () => {
        // The memory adapter's tables, typed by the rows these tests read; the others only need an id.
        const db = {
            user: new Array<UserRow>(),
            session: new Array<{ id: string }>(),
            account: new Array<{ id: string }>(),
            verification: new Array<{ id: string }>(),
            rateLimit: new Array<{ id: string }>(),
        };

        const memoryAuthDb = fake<AuthDatabase>(memoryAdapter(db));

        const auth = createAuth({
            database: memoryAuthDb,
            secret: 'test-secret-test-secret-test-secret-123',
            baseURL: 'http://localhost:4000',
            trustedOrigins: ['http://localhost:4000'],
        });

        return { auth, db };
    };

    const signUpAndGetCookie = async (
        auth: Auth
    ): Promise<{ cookieHeader: string; userId: string; username: string }> => {
        const signUp = await auth.api.signUpEmail({
            body: { email: 'x@y.z', name: 'Alice', password: 'password123', username: 'Alice' },
            asResponse: true,
        });

        const setCookie = signUp.headers.get('set-cookie');

        if (!setCookie) throw new Error('sign-up did not set the session cookie');
        const userId = signUpBody.parse(await signUp.json()).user.id;

        return { cookieHeader: setCookie.split(';')[0], userId, username: 'Alice' };
    };

    beforeEach(() => {
        __setAuthGetterForTests(() => undefined);
        vi.clearAllMocks();
        mockNext.mockClear();
    });

    it("sets c.get('user') to {id, username} when a session cookie is present", async () => {
        const { auth } = buildAuth();
        __setAuthGetterForTests(() => auth);
        const { cookieHeader, userId, username } = await signUpAndGetCookie(auth);

        const ctx = createMockContext({}, { cookie: cookieHeader });
        await authenticate(ctx, mockNext);

        expect(ctx.set).toHaveBeenCalledWith('user', { id: userId, username });
        expect(mockNext).toHaveBeenCalled();
    });

    it('returns 403 username_required when the session user has no username yet', async () => {
        const { auth, db } = buildAuth();
        __setAuthGetterForTests(() => auth);

        // Sign up normally so Better Auth hands back a properly-signed session cookie, then
        // mutate the in-memory user row to clear its username — Better Auth's username
        // validation hook rejects an empty username over its HTTP/adapter surface, but the
        // memory adapter here is just an array, so the path that drives `getSession` is what
        // a fresh Google sign-in (no username yet) actually looks like.
        const signUp = await auth.api.signUpEmail({
            body: {
                email: 'google-user@example.test',
                name: 'googleuser',
                password: 'password123',
                username: 'googleuser',
            },
            asResponse: true,
        });

        const cookieHeader = signUp.headers.get('set-cookie')?.split(';')[0];

        if (!cookieHeader) throw new Error('sign-up did not set the session cookie');
        const userId = signUpBody.parse(await signUp.json()).user.id;
        const target = db.user.find((u) => u.id === userId);

        if (target) {
            delete target.username;
            delete target.displayUsername;
        }

        const reqCtx = createMockContext({}, { cookie: cookieHeader });
        const result = await authenticate(reqCtx, mockNext);

        expect(result?.status).toBe(403);
        expect(await result?.json()).toEqual({ error: 'username_required' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when no session cookie is present', async () => {
        const { auth } = buildAuth();
        __setAuthGetterForTests(() => auth);
        const ctx = createMockContext({});
        const result = await authenticate(ctx, mockNext);
        expect(result?.status).toBe(401);
        expect(await result?.json()).toEqual({ error: 'Unauthorized' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // The public item-image route relies on this to know who pays for a generation; without the
    // user on the context, ImageService answers 401 for every uncached name.
    it('optionalAuthenticate sets the user when a session cookie is present', async () => {
        const { auth } = buildAuth();
        __setAuthGetterForTests(() => auth);
        const { cookieHeader, userId, username } = await signUpAndGetCookie(auth);

        const ctx = createMockContext({}, { cookie: cookieHeader });
        await optionalAuthenticate(ctx, mockNext);

        expect(ctx.set).toHaveBeenCalledWith('user', { id: userId, username });
        expect(mockNext).toHaveBeenCalled();
    });

    it('optionalAuthenticate lets an anonymous request through without a user', async () => {
        const { auth } = buildAuth();
        __setAuthGetterForTests(() => auth);

        const ctx = createMockContext({});
        const result = await optionalAuthenticate(ctx, mockNext);

        expect(result).toBeUndefined();
        expect(ctx.set).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
    });
});
