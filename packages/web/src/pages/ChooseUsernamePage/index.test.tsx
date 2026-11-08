import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isUsernameAvailable = vi.fn();
const updateUser = vi.fn();

vi.mock('../../auth/client', () => ({
    authClient: {
        isUsernameAvailable: (...args: unknown[]) => isUsernameAvailable(...args),
        updateUser: (...args: unknown[]) => updateUser(...args),
    },
}));

type Session = { user: User | null; needsUsername: boolean; isLoading: boolean };

const session: Session = { user: null, needsUsername: true, isLoading: false };

const refreshSession = vi.fn();

vi.mock('../../auth', () => ({
    useUser: () => ({ user: session.user, needsUsername: session.needsUsername }),
    useAuth: () => ({
        isAuthenticated: Boolean(session.user) || session.needsUsername,
        isLoading: session.isLoading,
        logout: vi.fn(),
    }),
    useRefreshSession: () => refreshSession,
}));

const migrateAfterAuth = vi.fn();

vi.mock('../../guest/useMigration', () => ({ useMigration: () => ({ migrateAfterAuth }) }));

import { type User } from '@tandra/types';

import ChooseUsernamePage from './index';

const renderPage = () =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={['/choose-username']}>
                <Routes>
                    <Route path="/choose-username" element={<ChooseUsernamePage />} />
                    <Route path="/" element={<p>Lists page</p>} />
                    <Route path="/login" element={<p>Login page</p>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );

describe('ChooseUsernamePage', () => {
    beforeEach(() => {
        Object.assign(session, { user: null, needsUsername: true, isLoading: false });
        isUsernameAvailable.mockReset().mockResolvedValue({ data: { available: true }, error: null });
        updateUser.mockReset().mockResolvedValue({ data: { status: true }, error: null });
        refreshSession.mockReset().mockImplementation(async () => {
            const user = { id: 'u1', username: 'NewName' };
            Object.assign(session, { user, needsUsername: false });

            return user;
        });
        migrateAfterAuth.mockReset().mockResolvedValue(undefined);
    });

    it('rejects a name shorter than 3 characters without asking the server', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText('Username'), 'ab');
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(await screen.findByText('Username must be at least 3 characters')).toBeInTheDocument();
        expect(updateUser).not.toHaveBeenCalled();
        expect(isUsernameAvailable).not.toHaveBeenCalled();
    });

    it('says a taken name is taken and does not save it', async () => {
        isUsernameAvailable.mockResolvedValue({ data: { available: false }, error: null });
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText('Username'), 'alice');

        expect(await screen.findByText('That username is taken')).toBeInTheDocument();
        expect(isUsernameAvailable).toHaveBeenCalledWith({ username: 'alice' });
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(updateUser).not.toHaveBeenCalled();
    });

    it('saves a free name, migrates guest data and opens the lists', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText('Username'), 'NewName');
        expect(await screen.findByText('That username is available')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(await screen.findByText('Lists page')).toBeInTheDocument();
        expect(updateUser).toHaveBeenCalledWith({ username: 'NewName', displayUsername: 'NewName' });
        expect(refreshSession).toHaveBeenCalledTimes(1);
        expect(migrateAfterAuth).toHaveBeenCalledWith({ id: 'u1', username: 'NewName' });
    });

    it('shows the server error when saving fails', async () => {
        updateUser.mockResolvedValue({ data: null, error: { code: 'USERNAME_IS_ALREADY_TAKEN', status: 400 } });
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText('Username'), 'raced');
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(await screen.findByText('That username is taken')).toBeInTheDocument();
        expect(refreshSession).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    });

    it('sends a signed-out visitor to login', () => {
        Object.assign(session, { user: null, needsUsername: false });
        renderPage();
        expect(screen.getByText('Login page')).toBeInTheDocument();
    });

    it('sends someone who already has a username to the lists', () => {
        Object.assign(session, { user: { id: 'u1', username: 'igor' }, needsUsername: false });
        renderPage();
        expect(screen.getByText('Lists page')).toBeInTheDocument();
    });
});
