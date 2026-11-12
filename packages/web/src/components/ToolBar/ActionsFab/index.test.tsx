import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckCheck, Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { ActionsFab } from './index';

describe('ActionsFab', () => {
    it('renders a disabled button when no action items are visible (keeps row layout stable)', () => {
        render(
            <ActionsFab actionItems={[{ show: false, label: 'Clear Selected', icon: CheckCheck, onClick: vi.fn() }]} />
        );
        expect(screen.getByTitle('Actions')).toBeDisabled();
    });

    it('does not expand when tapped with no visible action items', async () => {
        const user = userEvent.setup();
        render(
            <ActionsFab actionItems={[{ show: false, label: 'Clear Selected', icon: CheckCheck, onClick: vi.fn() }]} />
        );
        await user.click(screen.getByTitle('Actions'));
        expect(screen.queryByText('Clear Selected')).not.toBeInTheDocument();
    });

    it('renders a closed FAB when at least one action item is visible', () => {
        render(
            <ActionsFab actionItems={[{ show: true, label: 'Clear Selected', icon: CheckCheck, onClick: vi.fn() }]} />
        );
        expect(screen.getByTitle('Actions')).toBeInTheDocument();
        expect(screen.queryByText('Clear Selected')).not.toBeInTheDocument();
    });

    it('expands to show visible action items on tap', async () => {
        const user = userEvent.setup();
        render(
            <ActionsFab actionItems={[{ show: true, label: 'Clear Selected', icon: CheckCheck, onClick: vi.fn() }]} />
        );
        await user.click(screen.getByTitle('Actions'));
        expect(screen.getByText('Clear Selected')).toBeInTheDocument();
    });

    it('does not render hidden items even when expanded', async () => {
        const user = userEvent.setup();
        render(
            <ActionsFab
                actionItems={[
                    { show: true, label: 'Clear Selected', icon: CheckCheck, onClick: vi.fn() },
                    { show: false, label: 'Remove All', icon: Trash2, onClick: vi.fn() },
                ]}
            />
        );
        await user.click(screen.getByTitle('Actions'));
        expect(screen.getByText('Clear Selected')).toBeInTheDocument();
        expect(screen.queryByText('Remove All')).not.toBeInTheDocument();
    });

    it('calls onClick and collapses when an action item is clicked', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<ActionsFab actionItems={[{ show: true, label: 'Clear Selected', icon: CheckCheck, onClick }]} />);
        await user.click(screen.getByTitle('Actions'));
        await user.click(screen.getByTitle('Clear Selected'));
        expect(onClick).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('Clear Selected')).not.toBeInTheDocument());
    });

    it('collapses when the FAB is tapped a second time', async () => {
        const user = userEvent.setup();
        render(
            <ActionsFab actionItems={[{ show: true, label: 'Clear Selected', icon: CheckCheck, onClick: vi.fn() }]} />
        );
        await user.click(screen.getByTitle('Actions'));
        expect(screen.getByText('Clear Selected')).toBeInTheDocument();
        await user.click(screen.getByTitle('Actions'));
        await waitFor(() => expect(screen.queryByText('Clear Selected')).not.toBeInTheDocument());
    });

    it('does not call onClick for a disabled item', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <ActionsFab actionItems={[{ show: true, label: 'Remove All', icon: Trash2, onClick, disabled: true }]} />
        );
        await user.click(screen.getByTitle('Actions'));
        await user.click(screen.getByTitle('Remove All'));
        expect(onClick).not.toHaveBeenCalled();
    });
});
