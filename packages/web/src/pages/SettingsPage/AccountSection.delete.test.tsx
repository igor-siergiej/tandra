import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../auth/client', () => ({
    authClient: {
        listAccounts: vi.fn().mockResolvedValue({ data: [{ providerId: 'credential', accountId: 'u1' }], error: null }),
        linkSocial: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
}));

vi.mock('../../auth', () => ({
    useUser: () => ({ user: { id: 'u1', username: 'Igor' }, needsUsername: false }),
    useAuth: () => ({ isAuthenticated: true, isLoading: false, logout: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../../utils/useAiFeatures', () => ({ useAuthFeatures: () => ({ googleSignIn: false }) }));

vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { AccountSection } from './AccountSection';

const renderSection = () =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={['/settings']}>
                <AccountSection />
            </MemoryRouter>
        </QueryClientProvider>
    );

// The confirming button is the last "delete" control once the confirmation is open: either a dialog (which hides the
// section behind it) or the section itself opened up below the first button.
const confirmButton = () => {
    const buttons = screen.getAllByRole('button', { name: /delete/i });

    return buttons[buttons.length - 1];
};

describe('AccountSection: delete my account', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => vi.unstubAllGlobals());

    const deleteCalls = () =>
        fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/api/account') && init?.method === 'DELETE');

    it('offers a "Delete my account" action', () => {
        renderSection();

        expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
    });

    it('asks for the username and only enables the confirmation once it is typed exactly', async () => {
        const user = userEvent.setup();
        renderSection();

        await user.click(screen.getByRole('button', { name: /delete my account/i }));
        const field = await screen.findByRole('textbox');

        expect(confirmButton()).toBeDisabled();

        await user.type(field, 'Ig');
        expect(confirmButton()).toBeDisabled();

        await user.type(field, 'or!');
        expect(confirmButton()).toBeDisabled();

        await user.clear(field);
        await user.type(field, 'Igor');
        expect(confirmButton()).toBeEnabled();
        expect(deleteCalls()).toHaveLength(0);
    });

    it('sends the typed username in the body of DELETE /api/account', async () => {
        const user = userEvent.setup();
        renderSection();

        await user.click(screen.getByRole('button', { name: /delete my account/i }));
        await user.type(await screen.findByRole('textbox'), 'Igor');
        await user.click(confirmButton());

        await waitFor(() => expect(deleteCalls()).toHaveLength(1));
        const [, init] = deleteCalls()[0];

        expect(JSON.parse(String(init.body))).toEqual({ username: 'Igor' });
    });
});
