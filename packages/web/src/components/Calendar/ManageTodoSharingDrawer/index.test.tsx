import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { ManageTodoSharingDrawer } from './index';

const { mockUseFriends } = vi.hoisted(() => ({
    mockUseFriends: vi.fn(),
}));

vi.mock('../../../hooks/useFriends', () => ({
    useFriends: mockUseFriends,
}));

describe('ManageTodoSharingDrawer', () => {
    const mockOnOpenChange = vi.fn();
    const mockOnSave = vi.fn();

    const defaultProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        title: 'Pay rent',
        users: [{ id: 'friend-1', username: 'alice' }],
        onSave: mockOnSave,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseFriends.mockReturnValue({
            friends: [
                { id: 'friend-1', username: 'alice' },
                { id: 'friend-2', username: 'bob' },
            ],
            isLoading: false,
        });
    });

    it('renders drawer content when open', () => {
        render(<ManageTodoSharingDrawer {...defaultProps} />);

        expect(screen.getByText('Manage Sharing')).toBeInTheDocument();
        expect(screen.getByText('Pay rent')).toBeInTheDocument();
    });

    it('reflects the current shared users as toggled-on friends', () => {
        render(<ManageTodoSharingDrawer {...defaultProps} />);

        const switches = screen.getAllByRole('switch');
        expect(switches[0]).toBeChecked();
        expect(switches[1]).not.toBeChecked();
    });

    it('calls onSave with the full next user list when a friend is added', async () => {
        const user = userEvent.setup();
        render(<ManageTodoSharingDrawer {...defaultProps} />);

        await user.click(screen.getAllByRole('switch')[1]);

        expect(mockOnSave).toHaveBeenCalledWith([
            { id: 'friend-1', username: 'alice' },
            { id: 'friend-2', username: 'bob' },
        ]);
    });

    it('calls onSave with the friend removed when toggled off', async () => {
        const user = userEvent.setup();
        render(<ManageTodoSharingDrawer {...defaultProps} />);

        await user.click(screen.getAllByRole('switch')[0]);

        expect(mockOnSave).toHaveBeenCalledWith([]);
    });

    it('closes the drawer when Close is clicked', async () => {
        const user = userEvent.setup();
        render(<ManageTodoSharingDrawer {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: /close/i }));

        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
});
