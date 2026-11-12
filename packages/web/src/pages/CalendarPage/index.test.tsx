import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vite-plus/test';

import CalendarPage from './index';

// ToolBar pulls in auth/user/router providers; stub it for this unit test.
vi.mock('../../components/ToolBar', () => ({ default: () => null }));

vi.mock('../../auth', async () => {
    const actual = await vi.importActual<object>('../../auth');

    return { ...actual, useUser: () => ({ user: { id: 'u', username: 'owner' } }) };
});

vi.mock('../../contexts/PullToRefreshContext', () => ({
    usePullToRefreshContext: () => ({ registerRefresh: () => () => {} }),
}));

vi.mock('../../hooks/useTodos', () => ({
    useTodos: () => ({
        todos: [
            {
                id: 't1',
                ownerId: 'u',
                title: 'Standup',
                done: false,
                dateAdded: new Date('2026-06-01'),
                dueDate: '2026-06-04',
            },
            { id: 't2', ownerId: 'u', title: 'Someday', done: false, dateAdded: new Date('2026-06-01') },
        ],
        isLoading: false,
        isError: false,
        createTodo: vi.fn(),
        updateTodo: vi.fn(),
        completeTodo: vi.fn(),
        deleteTodo: vi.fn(),
        refetch: vi.fn(),
    }),
}));

vi.mock('../../hooks/useLabels', () => ({
    useLabels: () => ({ labels: [], isLoading: false, refetch: vi.fn() }),
}));

describe('CalendarPage', () => {
    it('renders the inbox count of undated todos', () => {
        render(
            <MemoryRouter>
                <CalendarPage />
            </MemoryRouter>
        );
        expect(screen.getByText(/Inbox \(1\)/)).toBeInTheDocument();
    });
});
