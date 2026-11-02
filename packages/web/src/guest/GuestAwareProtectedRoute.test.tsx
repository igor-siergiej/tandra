import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = { user: null as { id: string; username: string } | null, needsUsername: false, isGuest: false };

vi.mock('../auth', () => ({
    useUser: () => ({ user: session.user, needsUsername: session.needsUsername }),
    useAuth: () => ({ isAuthenticated: Boolean(session.user) || session.needsUsername, isLoading: false }),
    ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./GuestContext', () => ({ useGuest: () => ({ isGuest: session.isGuest, enterGuestMode: vi.fn() }) }));

import { GuestAwareProtectedRoute, RequireAuth } from './GuestAwareProtectedRoute';

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <GuestAwareProtectedRoute>
                            <p>Lists</p>
                        </GuestAwareProtectedRoute>
                    }
                />
                <Route
                    path="/recipes"
                    element={
                        <RequireAuth>
                            <p>Recipes</p>
                        </RequireAuth>
                    }
                />
                <Route path="/choose-username" element={<p>Choose a username</p>} />
                <Route path="/login" element={<p>Login</p>} />
            </Routes>
        </MemoryRouter>
    );

describe('guarded routes', () => {
    beforeEach(() => Object.assign(session, { user: null, needsUsername: false, isGuest: false }));

    it('sends a signed-in user without a username to choose one', () => {
        session.needsUsername = true;
        renderAt('/');
        expect(screen.getByText('Choose a username')).toBeInTheDocument();
    });

    it('sends them there from account-only routes too', () => {
        session.needsUsername = true;
        renderAt('/recipes');
        expect(screen.getByText('Choose a username')).toBeInTheDocument();
    });

    it('lets a user with a username through', () => {
        session.user = { id: 'u1', username: 'igor' };
        renderAt('/');
        expect(screen.getByText('Lists')).toBeInTheDocument();
    });

    it('sends a signed-out visitor to login', () => {
        renderAt('/');
        expect(screen.getByText('Login')).toBeInTheDocument();
    });
});
