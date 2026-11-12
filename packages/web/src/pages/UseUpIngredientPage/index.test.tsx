import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import UseUpIngredientPage from './index';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../auth', () => ({
    useUser: () => ({ user: { id: 'user-1' } }),
}));

let mockRecipes: unknown[] = [];

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: mockRecipes }),
}));

vi.mock('../../components/ToolBar', () => ({
    default: () => <div data-testid="toolbar" />,
}));

describe('UseUpIngredientPage', () => {
    it('prompts for an ingredient instead of listing results when the query is empty', () => {
        mockRecipes = [{ id: 'r1', title: 'Spinach Curry', ingredients: [{ id: 'i1', name: 'spinach' }], users: [] }];
        render(<UseUpIngredientPage />);

        expect(screen.getByText(/Type something you don't want to waste/)).toBeInTheDocument();
        expect(screen.queryByText('Spinach Curry')).not.toBeInTheDocument();
    });

    it('shows a clear empty state when nothing matches', async () => {
        mockRecipes = [{ id: 'r1', title: 'Chicken Soup', ingredients: [{ id: 'i1', name: 'chicken' }], users: [] }];
        render(<UseUpIngredientPage />);

        await userEvent.type(screen.getByPlaceholderText('e.g. spinach'), 'durian');

        expect(screen.getByText(/No recipes use anything like/)).toBeInTheDocument();
    });

    it('lists fuzzy-matched recipes badged with the ingredient that matched', async () => {
        mockRecipes = [
            { id: 'r1', title: 'Chicken Soup', ingredients: [{ id: 'i1', name: 'chicken' }], users: [] },
            { id: 'r2', title: 'Spinach Curry', ingredients: [{ id: 'i2', name: 'spinach' }], users: [] },
        ];
        render(<UseUpIngredientPage />);

        await userEvent.type(screen.getByPlaceholderText('e.g. spinach'), 'spinch');

        expect(screen.getByText('Spinach Curry')).toBeInTheDocument();
        expect(screen.getByText('uses spinach')).toBeInTheDocument();
        expect(screen.queryByText('Chicken Soup')).not.toBeInTheDocument();
    });

    it('navigates to the recipe detail page when a result is tapped', async () => {
        mockRecipes = [{ id: 'r1', title: 'Spinach Curry', ingredients: [{ id: 'i1', name: 'spinach' }], users: [] }];
        render(<UseUpIngredientPage />);

        await userEvent.type(screen.getByPlaceholderText('e.g. spinach'), 'spinach');
        await userEvent.click(screen.getByText('Spinach Curry'));

        expect(mockNavigate).toHaveBeenCalledWith('/recipes/r1');
    });

    it('does not focus the search field on load — the user taps to search', () => {
        mockRecipes = [];
        render(<UseUpIngredientPage />);

        expect(screen.getByPlaceholderText('e.g. spinach')).not.toHaveFocus();
    });
});
