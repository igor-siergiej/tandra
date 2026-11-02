import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorPage from './index';

vi.mock('../Appbar', () => ({
    default: () => <div data-testid="appbar">Appbar</div>,
}));

describe('ErrorPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders error icon and heading', () => {
        render(<ErrorPage />);

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders appbar', () => {
        render(<ErrorPage />);

        expect(screen.getByTestId('appbar')).toBeInTheDocument();
    });

    it('renders helpful error message', () => {
        render(<ErrorPage />);

        expect(
            screen.getByText(/An unexpected error occurred. Please try refreshing the page or contact support/)
        ).toBeInTheDocument();
    });

    it('renders refresh page button', () => {
        render(<ErrorPage />);

        const refreshButton = screen.getByRole('button', { name: /refresh page/i });
        expect(refreshButton).toBeInTheDocument();
    });

    it('renders go home button', () => {
        render(<ErrorPage />);

        const homeButton = screen.getByRole('button', { name: /go home/i });
        expect(homeButton).toBeInTheDocument();
    });

    it('handles refresh page button click', async () => {
        const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
        const user = userEvent.setup();

        render(<ErrorPage />);

        const refreshButton = screen.getByRole('button', { name: /refresh page/i });
        await user.click(refreshButton);

        expect(reloadSpy).toHaveBeenCalled();
        reloadSpy.mockRestore();
    });

    it('handles go home button click', async () => {
        Object.defineProperty(window, 'location', {
            value: {
                href: '/',
                reload: vi.fn(),
            },
            writable: true,
            configurable: true,
        });

        const user = userEvent.setup();

        render(<ErrorPage />);

        const homeButton = screen.getByRole('button', { name: /go home/i });
        await user.click(homeButton);

        expect(window.location.href).toBe('/');
    });

    it('uses min-h-screen for full height layout', () => {
        const { container } = render(<ErrorPage />);

        const mainDiv = container.firstChild as HTMLElement;
        expect(mainDiv).toHaveClass('min-h-screen', 'bg-background', 'flex', 'flex-col');
    });
});
