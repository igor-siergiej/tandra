import type { Context, Next } from 'hono';
import { dependencyContainer } from '../dependencies/container';
import { DependencyToken } from '../dependencies/types';
import type { Auth } from '../infrastructure/BetterAuth';

type AuthUser = { id: string; username: string };

type AuthVariables = { Variables: { user: AuthUser } };

// Resolve the Better Auth cookie session into `{id, username}`.
// Users who authenticated via Google without picking a username yet hit username_required
// (the web routes them to /choose-username). Returning `undefined` means "no session".
//
// `getAuthForRequest` is a test seam: production reads DependencyToken.Auth from the DI
// container, but tests install a `memoryAdapter` instance and reset it per case without
// poking into the container's internals.
type AuthGetter = () => Auth | undefined;
let getAuthForRequest: AuthGetter = () => dependencyContainer.resolve(DependencyToken.Auth);
// fallow-ignore-next-line unused-export
export const __setAuthGetterForTests = (next: AuthGetter) => {
    getAuthForRequest = next;
};

const sessionToAuthUser = (
    session: { user: { id: string; username?: string | null; displayUsername?: string | null } },
    c: Context<AuthVariables>
): AuthUser | Response => {
    // The display name is only a casing of the unique username; one that names somebody else is ignored.
    const { displayUsername: display, username: unique } = session.user;
    const username = display && unique && display.toLowerCase() === unique.toLowerCase() ? display : unique;
    if (!username) {
        return c.json({ error: 'username_required' }, 403);
    }
    return { id: session.user.id, username };
};

const resolveBetterAuthSession = async (c: Context<AuthVariables>): Promise<AuthUser | undefined | Response> => {
    const auth = getAuthForRequest();
    if (!auth) return undefined;
    try {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!session) return undefined;
        return sessionToAuthUser(session, c);
    } catch (error) {
        console.error('Better Auth getSession failed:', error);
        return undefined;
    }
};

export const authenticate = async (c: Context<AuthVariables>, next: Next) => {
    const sessionUser = await resolveBetterAuthSession(c);
    if (sessionUser instanceof Response) {
        return sessionUser;
    }
    if (!sessionUser) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', sessionUser);
    return next();
};

// For public routes where a signed-in caller unlocks more (e.g. `conditionalImageAuth` in
// routes/index.ts): sets `user` when a usable session is present, never rejects the request.
export const optionalAuthenticate = async (c: Context<AuthVariables>, next: Next) => {
    const sessionUser = await resolveBetterAuthSession(c);
    if (sessionUser && !(sessionUser instanceof Response)) {
        c.set('user', sessionUser);
    }
    return next();
};
