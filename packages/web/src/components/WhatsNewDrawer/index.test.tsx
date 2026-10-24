import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WhatsNewDrawer from './index';

vi.mock('../../data/release-notes.json', () => ({
    default: [
        { version: '1.3.0', date: '2026-09-21', notes: [{ type: 'feature', text: 'Recipes get a use-it-up page' }] },
        { version: '1.2.1', date: '2026-09-14', notes: [{ type: 'fix', text: 'Recipe grid is wider on desktop' }] },
        { version: '1.2.0', date: '2026-09-01', notes: [{ type: 'improvement', text: 'Photos load faster' }] },
    ],
}));

describe('WhatsNewDrawer', () => {
    it('lists every release with its date and notes', () => {
        render(<WhatsNewDrawer open onOpenChange={vi.fn()} highlightSince={null} />);

        expect(screen.getByText('v1.3.0')).toBeInTheDocument();
        expect(screen.getByText('21 Sep 2026')).toBeInTheDocument();
        expect(screen.getByText('Recipes get a use-it-up page')).toBeInTheDocument();
        expect(screen.getByText('Photos load faster')).toBeInTheDocument();
    });

    it('labels each note by the kind of change it was', () => {
        render(<WhatsNewDrawer open onOpenChange={vi.fn()} highlightSince={null} />);

        expect(screen.getByText('Added')).toBeInTheDocument();
        expect(screen.getByText('Fixed')).toBeInTheDocument();
        expect(screen.getByText('Improved')).toBeInTheDocument();
    });

    it('flags only the releases newer than the last one the user read', () => {
        render(<WhatsNewDrawer open onOpenChange={vi.fn()} highlightSince="1.2.0" />);

        const unread = screen.getAllByText('New');

        expect(unread).toHaveLength(2);
    });

    it('flags nothing for a first-time visitor', () => {
        render(<WhatsNewDrawer open onOpenChange={vi.fn()} highlightSince={null} />);

        expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('renders nothing while closed', () => {
        render(<WhatsNewDrawer open={false} onOpenChange={vi.fn()} highlightSince={null} />);

        expect(screen.queryByText('Recipes get a use-it-up page')).not.toBeInTheDocument();
    });

    it('links to the privacy notice in a new tab', () => {
        render(<WhatsNewDrawer open onOpenChange={vi.fn()} highlightSince={null} />);

        const link = screen.getByRole('link', { name: 'Privacy' });
        expect(link).toHaveAttribute('href', 'https://tandra.uk/privacy');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener');
    });
});
