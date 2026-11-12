import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const listAccounts = vi.fn();
const linkSocial = vi.fn();

vi.mock('../../auth/client', () => ({
    authClient: {
        listAccounts: (...args: unknown[]) => listAccounts(...args),
        linkSocial: (...args: unknown[]) => linkSocial(...args),
    },
}));

const session = { user: { id: 'u1', username: 'Igor' } as { id: string; username: string } | null };

vi.mock('../../auth', () => ({ useUser: () => ({ user: session.user, needsUsername: false }) }));

const features = { googleSignIn: true };

vi.mock('../../utils/useAiFeatures', () => ({ useAuthFeatures: () => features }));

import { AccountSection } from './AccountSection';

const renderSection = (path = '/settings') =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={[path]}>
                <AccountSection />
            </MemoryRouter>
        </QueryClientProvider>
    );

const credentialOnly = { data: [{ providerId: 'credential', accountId: 'u1' }], error: null };

describe('AccountSection', () => {
    beforeEach(() => {
        session.user = { id: 'u1', username: 'Igor' };
        features.googleSignIn = true;
        listAccounts.mockReset().mockResolvedValue(credentialOnly);
        linkSocial.mockReset().mockResolvedValue({ data: { url: 'https://accounts.google.com' }, error: null });
    });

    it('shows the username', async () => {
        renderSection();
        expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
        expect(screen.getByText('Igor')).toBeInTheDocument();
        await screen.findByRole('button', { name: 'Link Google account' });
    });

    it('links Google when enabled and not linked yet', async () => {
        const user = userEvent.setup();
        renderSection();

        await user.click(await screen.findByRole('button', { name: 'Link Google account' }));

        expect(linkSocial).toHaveBeenCalledWith({
            provider: 'google',
            callbackURL: '/settings',
            errorCallbackURL: '/settings',
        });
    });

    it('says Google is linked once it is', async () => {
        listAccounts.mockResolvedValue({
            data: [...credentialOnly.data, { providerId: 'google', accountId: 'g-1' }],
            error: null,
        });
        renderSection();

        expect(await screen.findByText('Google linked')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Link Google account' })).not.toBeInTheDocument();
    });

    it('offers no Google link when the server has Google sign-in off', async () => {
        features.googleSignIn = false;
        renderSection();

        expect(screen.getByText('Igor')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Link Google account' })).not.toBeInTheDocument();
        expect(screen.queryByText('Google linked')).not.toBeInTheDocument();
        expect(listAccounts).not.toHaveBeenCalled();
    });

    it('explains a failed link from the callback error', async () => {
        renderSection('/settings?error=account_already_linked_to_different_user');
        expect(
            await screen.findByText('That Google account is already used by another Tandra account.')
        ).toBeInTheDocument();
    });

    it('renders nothing for a guest', () => {
        session.user = null;
        const { container } = renderSection();
        expect(container).toBeEmptyDOMElement();
    });
});
