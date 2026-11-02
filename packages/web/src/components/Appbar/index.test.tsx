import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Appbar from './index';

vi.mock('../../data/release-notes.json', () => ({
    default: [
        { version: '1.3.0', date: '2026-09-21', notes: [{ type: 'feature', text: 'Recipes get a use-it-up page' }] },
        { version: '1.2.0', date: '2026-09-01', notes: [{ type: 'fix', text: 'Photos load faster' }] },
    ],
}));

const STORAGE_KEY = 'tandra:lastSeenVersion';

describe('Appbar', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });
    it('renders header element', () => {
        const { container } = render(<Appbar />);

        const header = container.querySelector('header');
        expect(header).toBeInTheDocument();
    });

    it('renders the logo', () => {
        render(<Appbar />);

        expect(screen.getByAltText('Tandra')).toBeInTheDocument();
    });

    it('displays app title "Tandra"', () => {
        render(<Appbar />);

        expect(screen.getByText('Tandra')).toBeInTheDocument();
    });

    it('has fixed positioning styling', () => {
        const { container } = render(<Appbar />);

        const header = container.querySelector('header');
        expect(header).toHaveClass('fixed', 'top-0', 'left-0', 'right-0', 'z-50');
    });

    it('has primary background color', () => {
        const { container } = render(<Appbar />);

        const header = container.querySelector('header');
        expect(header).toHaveClass('bg-primary', 'shadow-md');
    });

    it('has a thin, fixed-height content row', () => {
        const { container } = render(<Appbar />);

        const contentDiv = container.querySelector('div[class*="h-14"]');
        expect(contentDiv).toHaveClass('flex', 'items-center', 'justify-between', 'h-14');
    });

    it('marks a returning user behind the latest release as having unread notes', () => {
        window.localStorage.setItem(STORAGE_KEY, '1.2.0');

        render(<Appbar />);

        expect(screen.getByTestId('whats-new-indicator')).toBeInTheDocument();
    });

    it('shows no unread indicator once the user has seen the latest release', () => {
        window.localStorage.setItem(STORAGE_KEY, '1.3.0');

        render(<Appbar />);

        expect(screen.queryByTestId('whats-new-indicator')).not.toBeInTheDocument();
    });

    it('treats a first-time visitor as up to date instead of flagging every past release', () => {
        render(<Appbar />);

        expect(screen.queryByTestId('whats-new-indicator')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1.3.0');
    });

    it('opens the notes on the version badge, flagging what was unread, and clears the indicator', async () => {
        const user = userEvent.setup();
        window.localStorage.setItem(STORAGE_KEY, '1.2.0');

        render(<Appbar />);
        await user.click(screen.getByRole('button', { name: /what's new/i }));

        expect(await screen.findByText('Recipes get a use-it-up page', {}, { timeout: 5000 })).toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.queryByTestId('whats-new-indicator')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1.3.0');
    });

    it('does not load the release history until the notes are opened', async () => {
        const user = userEvent.setup();

        render(<Appbar />);

        expect(screen.queryByText("What's new")).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /what's new/i }));
        expect(await screen.findByText("What's new", {}, { timeout: 5000 })).toBeInTheDocument();
    });
});
