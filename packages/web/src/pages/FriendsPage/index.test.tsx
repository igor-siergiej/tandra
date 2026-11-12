import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import FriendsPage from './index';

vi.mock('../../components/ToolBar', () => ({ default: () => null }));

const mockUseFriends = vi.fn();
const mockUseUnfriend = vi.fn();

vi.mock('../../hooks/useFriends', () => ({
    useFriends: () => mockUseFriends(),
    useUnfriend: () => mockUseUnfriend(),
}));

describe('FriendsPage', () => {
    it('renders a row per friend', () => {
        mockUseFriends.mockReturnValue({
            friends: [
                { id: 'f1', username: 'alice' },
                { id: 'f2', username: 'bob' },
            ],
            isLoading: false,
        });
        mockUseUnfriend.mockReturnValue({ mutate: vi.fn(), isLoading: false });

        render(<FriendsPage />);

        expect(screen.getByText('alice')).toBeInTheDocument();
        expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('renders empty-state copy when there are no friends', () => {
        mockUseFriends.mockReturnValue({ friends: [], isLoading: false });
        mockUseUnfriend.mockReturnValue({ mutate: vi.fn(), isLoading: false });

        render(<FriendsPage />);

        expect(screen.getByText('No friends yet')).toBeInTheDocument();
    });
});
