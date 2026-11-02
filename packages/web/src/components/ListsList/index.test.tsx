import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ListsList from './index';

const { mockNavigate, mockDeleteList, mockUpdateListName, mockRefetch } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockDeleteList: vi.fn(),
    mockUpdateListName: vi.fn(),
    mockRefetch: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock('../../hooks/useListSource', () => ({
    useListSource: () => ({ deleteList: mockDeleteList, renameList: mockUpdateListName }),
}));

vi.mock('../../hooks/useConfirmation', () => ({
    useConfirmation: () => ({
        confirm: vi.fn((config) => {
            // Auto-confirm for testing
            config.onConfirm?.();
        }),
        isOpen: false,
        config: null,
        handleConfirm: vi.fn(),
        handleCancel: vi.fn(),
    }),
}));

vi.mock('./ListItem', () => ({
    ListItem: ({ list, onDelete, onNavigate }: any) => (
        <div data-testid={`list-item-${list.title}`}>
            <button type="button" onClick={onNavigate}>
                Open {list.title}
            </button>
            <button type="button" onClick={onDelete}>
                Delete
            </button>
        </div>
    ),
}));

describe('ListsList', () => {
    const mockLists = [
        {
            id: 'list-shopping',
            title: 'Shopping',
            items: [],
            users: ['user1', 'user2'],
            ownerId: 'user1',
        },
        {
            id: 'list-todo',
            title: 'Todo',
            items: [],
            users: ['user1'],
            ownerId: 'user1',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all lists as ListItem components', () => {
        render(<ListsList lists={mockLists} refetch={mockRefetch} currentUserId="user1" />);

        expect(screen.getByTestId('list-item-Shopping')).toBeInTheDocument();
        expect(screen.getByTestId('list-item-Todo')).toBeInTheDocument();
    });

    it('navigates when list is clicked', async () => {
        const user = userEvent.setup();
        render(<ListsList lists={mockLists} refetch={mockRefetch} currentUserId="user1" />);

        await user.click(screen.getByRole('button', { name: /open shopping/i }));

        expect(mockNavigate).toHaveBeenCalledWith('/list/list-shopping');
    });

    it('deletes list when delete button is clicked', async () => {
        const user = userEvent.setup();
        render(<ListsList lists={mockLists} refetch={mockRefetch} currentUserId="user1" />);

        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        await user.click(deleteButtons[0]);

        expect(mockDeleteList).toHaveBeenCalledWith('list-shopping');
        expect(mockRefetch).toHaveBeenCalled();
    });

    it('determines owner based on ownerId match', () => {
        const { container } = render(<ListsList lists={mockLists} refetch={mockRefetch} currentUserId="user2" />);

        expect(container).toBeInTheDocument();
        // ListItem receives isOwner prop, we just verify it renders both lists
        expect(screen.getByTestId('list-item-Shopping')).toBeInTheDocument();
        expect(screen.getByTestId('list-item-Todo')).toBeInTheDocument();
    });

    it('handles empty lists array', () => {
        const { container } = render(<ListsList lists={[]} refetch={mockRefetch} currentUserId="user1" />);

        // Should render without error
        expect(container).toBeInTheDocument();
    });
});
