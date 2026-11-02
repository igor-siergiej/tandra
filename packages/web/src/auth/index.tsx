/**
 * The web's only auth surface. The session is Tandra's own Better Auth cookie (httpOnly,
 * same-origin), so nothing here holds a credential: requests carry the cookie by themselves.
 * This module tracks who is signed in, keeps a copy for offline launches (`sessionCache`), and
 * exposes the narrow hooks every component reads.
 */

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { authClient } from './client';
import { fetchSession, type SessionSnapshot, type SessionUser, SIGNED_OUT } from './fetchSession';
import { returningUserCookie } from './returningUserCookie';
import { sessionCache } from './sessionCache';

export type { SessionUser };

export interface UserState {
    user: SessionUser | null;
    /** Signed in (e.g. through Google) but no username picked yet. */
    needsUsername: boolean;
}

export interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => Promise<void>;
}

let returningUserMarked = false;

// The landing site reads this cookie to send returning visitors straight to the app. Marked once
// per page load, so its year-long expiry slides with use.
const markReturningUser = () => {
    if (returningUserMarked) return;
    returningUserMarked = true;
    const cookie = returningUserCookie(window.location.hostname);

    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from Firefox.
    if (cookie) document.cookie = cookie;
};

// Set while a sign-out has not reached the server (offline, network error). The httpOnly cookie is still
// valid then, so the next launch must finish the sign-out before asking who is signed in.
const SIGN_OUT_PENDING_KEY = 'tandra:sign-out-pending';

const signOutOnServer = async (): Promise<boolean> => {
    try {
        const { error } = await authClient.signOut({});

        return !error;
    } catch {
        return false;
    }
};

const finishPendingSignOut = async (): Promise<boolean> => {
    if (!localStorage.getItem(SIGN_OUT_PENDING_KEY)) return true;

    if (!(await signOutOnServer())) return false;
    localStorage.removeItem(SIGN_OUT_PENDING_KEY);

    return true;
};

interface AuthContextValue {
    session: SessionSnapshot;
    isLoading: boolean;
    refresh: () => Promise<SessionSnapshot>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const useAuthContext = (): AuthContextValue => {
    const context = useContext(AuthContext);

    if (!context) throw new Error('Auth hooks must be used inside <AuthRoot>');

    return context;
};

/** Resolves the session on mount and supplies the hooks below. */
export const AuthRoot = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<SessionSnapshot>(SIGNED_OUT);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        const next = await fetchSession();

        if (next.user || next.needsUsername) markReturningUser();
        setSession(next);

        return next;
    }, []);

    const logout = useCallback(async () => {
        sessionCache.clear();
        setSession(SIGNED_OUT);
        localStorage.setItem(SIGN_OUT_PENDING_KEY, '1');
        await finishPendingSignOut();
    }, []);

    useEffect(() => {
        const start = async () => {
            // Until an earlier sign-out reaches the server, stay signed out rather than trust the cookie.
            if (await finishPendingSignOut()) await refresh();
        };

        void start().finally(() => setIsLoading(false));
    }, [refresh]);

    const signedIn = Boolean(session.user) || session.needsUsername;
    useEffect(() => {
        if (signedIn) return;

        // An installed PWA can come back to the foreground from a Google sign-in without reloading (the
        // callback set the cookie in another tab), so ask again rather than keep showing /login.
        const recheck = () => {
            if (document.visibilityState !== 'visible') return;
            void finishPendingSignOut().then((finished) => finished && refresh());
        };

        document.addEventListener('visibilitychange', recheck);

        return () => document.removeEventListener('visibilitychange', recheck);
    }, [signedIn, refresh]);

    const value = useMemo(() => ({ session, isLoading, refresh, logout }), [session, isLoading, refresh, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** The current user, or null while signed out / still resolving. */
export const useUser = (): UserState => {
    const { session } = useAuthContext();

    return { user: session.user, needsUsername: session.needsUsername };
};

/** Sign-in state and the sign-out action. `isLoading` is true until the first session check settles. */
export const useAuth = (): AuthState => {
    const { session, isLoading, logout } = useAuthContext();

    return { isAuthenticated: Boolean(session.user) || session.needsUsername, isLoading, logout };
};

/**
 * Re-reads the session after sign-in or sign-up; resolves to the signed-in user, if any. The fresh cookie
 * replaced any session an earlier offline sign-out left behind, so there is nothing left to finish.
 */
export const useRefreshSession = (): (() => Promise<SessionUser | null>) => {
    const { refresh } = useAuthContext();

    return useCallback(async () => {
        localStorage.removeItem(SIGN_OUT_PENDING_KEY);

        return (await refresh()).user;
    }, [refresh]);
};

/** Redirects to `/login` when signed out, remembering where the visitor was headed. */
export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

    return <>{children}</>;
};
