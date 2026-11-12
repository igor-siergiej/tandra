import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import ConfigLoader from './index';

vi.mock('../../utils/config', () => ({
    loadConfig: vi.fn(),
}));

vi.mock('../LoadingPage', () => ({
    default: () => <div data-testid="loading-spinner" />,
}));

vi.mock('../ErrorPage', () => ({
    default: ({ error }: { error: Error }) => <div data-testid="error-page">{error.message}</div>,
}));

import { loadConfig } from '../../utils/config';

describe('ConfigLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows loading spinner while loading config', async () => {
        (loadConfig as any).mockImplementation(() => new Promise(() => {}));

        render(<ConfigLoader>Test Content</ConfigLoader>);

        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('renders children when config loads successfully', async () => {
        (loadConfig as any).mockResolvedValue(undefined);

        render(<ConfigLoader>Test Content</ConfigLoader>);

        await waitFor(() => {
            expect(screen.getByText('Test Content')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('shows error page when config loading fails', async () => {
        const testError = new Error('Config load failed');
        (loadConfig as any).mockRejectedValue(testError);

        render(<ConfigLoader>Test Content</ConfigLoader>);

        await waitFor(() => {
            expect(screen.getByTestId('error-page')).toBeInTheDocument();
        });

        expect(screen.getByText('Config load failed')).toBeInTheDocument();
    });

    it('handles non-Error objects during config load', async () => {
        (loadConfig as any).mockRejectedValue({ someProperty: 'value' });

        render(<ConfigLoader>Test Content</ConfigLoader>);

        await waitFor(() => {
            expect(screen.getByTestId('error-page')).toBeInTheDocument();
        });

        expect(screen.getByText('Failed to load configuration')).toBeInTheDocument();
    });

    it('handles unknown error objects gracefully', async () => {
        (loadConfig as any).mockRejectedValue({ someField: 'value' });

        render(<ConfigLoader>Test Content</ConfigLoader>);

        await waitFor(() => {
            expect(screen.getByTestId('error-page')).toBeInTheDocument();
        });

        expect(screen.getByText('Failed to load configuration')).toBeInTheDocument();
    });
});
