import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../auth/client', () => ({
    authClient: { listAccounts: vi.fn().mockResolvedValue({ data: [], error: null }), linkSocial: vi.fn() },
}));

vi.mock('../../auth', () => ({
    useUser: () => ({ user: { id: 'u1', username: 'Igor' }, needsUsername: false }),
    useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../../utils/useAiFeatures', () => ({ useAuthFeatures: () => ({ googleSignIn: false }) }));

import { AccountSection } from './AccountSection';

describe('AccountSection data export', () => {
    it('offers "Export my data" under Account', () => {
        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/settings']}>
                    <AccountSection />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
        expect(screen.getByText('Export my data')).toBeInTheDocument();
    });
});
