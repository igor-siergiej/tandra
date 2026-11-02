import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppInitializer from './index';

const authState = { isAuthenticated: false, isLoading: true, logout: vi.fn(async () => {}) };

const refreshSession = vi.fn(async () => null);
vi.mock('../../auth', () => ({ useAuth: () => authState, useRefreshSession: () => refreshSession }));

vi.mock('../../hooks/usePWA', () => ({
    usePWA: vi.fn(() => ({ isUpdating: false })),
}));

vi.mock('../../offline/outboxStore', () => ({
    outboxStore: { hydrate: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../offline/drainer', () => ({
    startDrainer: vi.fn().mockReturnValue(() => {}),
    onIntentsDiscarded: vi.fn().mockReturnValue(() => {}),
}));

const renderApp = () =>
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={['/lists']}>
                <Routes>
                    <Route path="/lists" element={<AppInitializer>Test Content</AppInitializer>} />
                    <Route path="/login" element={<p>Login screen</p>} />
                    <Route path="/choose-username" element={<p>Choose a username</p>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );

describe('AppInitializer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.assign(authState, { isAuthenticated: false, isLoading: true });
        authState.logout.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the loader while the session check is in flight', () => {
        renderApp();
        expect(document.querySelector('.loader')).toBeInTheDocument();
        expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('renders the app once the session check has settled', () => {
        Object.assign(authState, { isAuthenticated: true, isLoading: false });
        renderApp();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('offers recovery steps when the session check takes over 10 seconds', async () => {
        renderApp();
        expect(screen.queryByText('Taking longer than expected...')).not.toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(10000);
        });

        expect(screen.getByText('Taking longer than expected...')).toBeInTheDocument();
        expect(screen.getByText('Hard refresh (Ctrl+F5)')).toBeInTheDocument();
    });

    it('signs out and goes to login when a signed-in session expires', async () => {
        Object.assign(authState, { isAuthenticated: true, isLoading: false });
        renderApp();

        await act(async () => {
            window.dispatchEvent(new CustomEvent('auth:session-expired'));
        });

        expect(authState.logout).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Login screen')).toBeInTheDocument();
    });

    it('leaves a guest in place when an account-only request is refused', async () => {
        Object.assign(authState, { isAuthenticated: false, isLoading: false });
        renderApp();

        await act(async () => {
            window.dispatchEvent(new CustomEvent('auth:session-expired'));
        });

        expect(authState.logout).not.toHaveBeenCalled();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('re-reads the session and asks for a username when the api requires one', async () => {
        Object.assign(authState, { isAuthenticated: true, isLoading: false });
        refreshSession.mockClear();
        renderApp();

        await act(async () => {
            window.dispatchEvent(new CustomEvent('auth:username-required'));
        });

        expect(refreshSession).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Choose a username')).toBeInTheDocument();
    });
});
