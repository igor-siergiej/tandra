import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ProtectedRoute, useAuth, useUser } from '../auth';
import LoadingPage from '../components/LoadingPage';
import { useGuest } from './GuestContext';

interface GuestAwareProtectedRouteProps {
    children: ReactNode;
}

// Routes wrapped by this component accept either an authenticated session or
// an active guest session. Logged-out visitors are bounced to /login; a
// signed-in user who has not picked a username yet (fresh Google sign-up) is
// sent to pick one first.
export const GuestAwareProtectedRoute = ({ children }: GuestAwareProtectedRouteProps) => {
    const { isAuthenticated } = useAuth();
    const { needsUsername } = useUser();
    const { isGuest } = useGuest();
    const location = useLocation();

    if (needsUsername) return <Navigate to="/choose-username" replace />;

    if (isAuthenticated || isGuest) {
        return <>{children}</>;
    }

    return <Navigate to="/login" state={{ from: location }} replace />;
};

// When a route requires an actual account (AI, sharing, calendar, friends)
// wrap it with this. Guests get the same auth wall plus a CTA to register or
// log in, so the page never silently fails for them.
export const RequireAuth = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const { needsUsername } = useUser();
    const { isGuest } = useGuest();
    const location = useLocation();

    if (needsUsername) return <Navigate to="/choose-username" replace />;

    if (isAuthenticated) {
        return <>{children}</>;
    }

    if (isGuest) {
        // The route's first segment (`recipes`, `discover`, `calendar`, ...) names the locked feature without
        // carrying ids, so the prompt can report which feature sends guests to sign up. Every account-only
        // route has one; `/` is never behind this guard.
        const feature = location.pathname.split('/')[1];

        return <Navigate to="/signup-cta" state={{ reason: 'auth-required', feature }} replace />;
    }

    // Not logged in and not in guest mode: defer to the existing behaviour so
    // we don't fork the auth flow.
    return <ProtectedRoute>{children}</ProtectedRoute>;
};

// Deep-link entry point (`/try`) so the landing site can drop a visitor
// straight into guest mode. Signed-in users just go to their lists, so it
// waits for the session check before deciding. The redirect also waits for
// the guest flag to land: navigating first would hit the guard at `/` while
// the visitor is still logged out and bounce to /login.
export const GuestEntryRoute = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const { isGuest, enterGuestMode } = useGuest();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !isGuest) enterGuestMode('try_link');
    }, [isLoading, isAuthenticated, isGuest, enterGuestMode]);

    if (isAuthenticated || isGuest) return <Navigate to="/" replace />;

    return <LoadingPage />;
};
