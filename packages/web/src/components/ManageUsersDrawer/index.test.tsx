import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManageUsersDrawer } from './index';

const { mockUseFriends, mockAddMutate, mockRemoveMutate } = vi.hoisted(() => ({
    mockUseFriends: vi.fn(),
    mockAddMutate: vi.fn(),
    mockRemoveMutate: vi.fn(),
}));

vi.mock('../../hooks/useFriends', () => ({
    useFriends: mockUseFriends,
}));

describe('ManageUsersDrawer', () => {
    const mockOnOpenChange = vi.fn();
    const mockOnUserAdded = vi.fn();
    const mockOnUserRemoved = vi.fn();

    const defaultProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        title: 'Shopping List',
        currentUsers: [
            { id: 'owner-1', username: 'john' },
            { id: 'friend-1', username: 'alice' },
        ],
        ownerId: 'owner-1',
        currentUserId: 'owner-1',
        addUserMutation: { isLoading: false, mutate: mockAddMutate },
        removeUserMutation: { isLoading: false, mutate: mockRemoveMutate },
        onUserAdded: mockOnUserAdded,
        onUserRemoved: mockOnUserRemoved,
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
        render(<ManageUsersDrawer {...defaultProps} />);

        expect(screen.getByText('Manage Users')).toBeInTheDocument();
        expect(screen.getByText('Shopping List')).toBeInTheDocument();
    });

    it('shows the owner', () => {
        render(<ManageUsersDrawer {...defaultProps} />);

        expect(screen.getByText('Owner: john')).toBeInTheDocument();
    });

    it('reflects current members as toggled-on friends', () => {
        render(<ManageUsersDrawer {...defaultProps} />);

        const switches = screen.getAllByRole('switch');
        // alice (friend-1) is a current member; bob (friend-2) is not.
        expect(switches[0]).toBeChecked();
        expect(switches[1]).not.toBeChecked();
    });

    it('closes drawer when close button is clicked', async () => {
        const user = userEvent.setup();
        render(<ManageUsersDrawer {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('adds a user and calls onUserAdded when toggling a non-member friend on', async () => {
        mockAddMutate.mockImplementation((_id, opts) => opts?.onSuccess?.());
        const user = userEvent.setup();
        render(<ManageUsersDrawer {...defaultProps} />);

        const switches = screen.getAllByRole('switch');
        await user.click(switches[1]);

        expect(mockAddMutate).toHaveBeenCalledWith(
            'friend-2',
            expect.objectContaining({ onSuccess: expect.any(Function) })
        );
        expect(mockOnUserAdded).toHaveBeenCalled();
    });

    it('opens a confirm dialog instead of removing immediately when toggling a member off', async () => {
        const user = userEvent.setup();
        render(<ManageUsersDrawer {...defaultProps} />);

        const switches = screen.getAllByRole('switch');
        await user.click(switches[0]);

        expect(screen.getByText('Remove alice from this list?')).toBeInTheDocument();
        expect(mockRemoveMutate).not.toHaveBeenCalled();
    });

    it('removes a user and calls onUserRemoved when the removal is confirmed', async () => {
        mockRemoveMutate.mockImplementation((_id, opts) => opts?.onSuccess?.());
        const user = userEvent.setup();
        render(<ManageUsersDrawer {...defaultProps} />);

        const switches = screen.getAllByRole('switch');
        await user.click(switches[0]);
        await user.click(screen.getByRole('button', { name: 'Remove' }));

        expect(mockRemoveMutate).toHaveBeenCalledWith(
            'friend-1',
            expect.objectContaining({ onSuccess: expect.any(Function) })
        );
        expect(mockOnUserRemoved).toHaveBeenCalled();
    });

    it('does not remove the user and keeps the toggle on when the removal is cancelled', async () => {
        const user = userEvent.setup();
        render(<ManageUsersDrawer {...defaultProps} />);

        const switches = screen.getAllByRole('switch');
        await user.click(switches[0]);
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(mockRemoveMutate).not.toHaveBeenCalled();
        expect(mockOnUserRemoved).not.toHaveBeenCalled();

        const switchesAfterCancel = screen.getAllByRole('switch');
        expect(switchesAfterCancel[0]).toBeChecked();
    });
});
