import type { Recipe } from '@tandra/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecipeDetailPage from './index';

vi.mock('../../auth', () => ({
    useUser: () => ({ user: { id: 'user-1', username: 'testuser' } }),
}));

const mockUpdateRecipe = vi.fn();
vi.mock('../../hooks/useRecipeMutations', () => ({
    useRecipeMutations: () => ({ updateRecipe: mockUpdateRecipe, deleteRecipe: vi.fn() }),
}));

vi.mock('../../hooks/useManageRecipeUsers', () => ({
    useManageRecipeUsers: () => ({ addUserMutation: {}, removeUserMutation: {} }),
}));

// Real ToolBar has no direct "select mode" prop for tests to flip; expose a button
// that calls the callback the page wires up, so tests can trigger select mode like a user would.
vi.mock('../../components/ToolBar', () => ({
    default: ({ onToggleSelectMode }: { onToggleSelectMode: () => void }) => (
        <div data-testid="toolbar">
            <button type="button" onClick={onToggleSelectMode}>
                Toggle Select Mode
            </button>
        </div>
    ),
}));
vi.mock('../../components/ManageUsersDrawer', () => ({ ManageUsersDrawer: () => null }));
vi.mock('./CoverImageSection', () => ({ CoverImageSection: () => <div data-testid="cover-image" /> }));
vi.mock('./IngredientSelectSection', () => ({ IngredientSelectSection: () => null }));
vi.mock('./IngredientsSection', () => ({ IngredientsSection: () => null }));
vi.mock('./InstructionsSection', () => ({ InstructionsSection: () => null }));
vi.mock('./TagsSection', () => ({ TagsSection: () => null }));
vi.mock('./PublishSection', () => ({ PublishSection: () => null }));

let mockRecipe: Recipe;

vi.mock('../../api', () => ({
    getRecipeQuery: (id: string) => ({ queryKey: ['recipe', id], queryFn: async () => mockRecipe }),
    getListsQuery: () => ({ queryKey: ['lists'], queryFn: async () => [] }),
    addItemsBulk: vi.fn(),
}));

const renderPage = (recipeId = 'recipe-1') => {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/recipes/${recipeId}`]}>
                <Routes>
                    <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('RecipeDetailPage', () => {
    beforeEach(() => {
        mockUpdateRecipe.mockReset();
    });

    it('renders a long title in full, without truncating', async () => {
        const longTitle = "Grandma's Slow-Cooked Beef Bourguignon With Red Wine And Root Vegetables";
        mockRecipe = {
            id: 'recipe-1',
            title: longTitle,
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        const heading = await screen.findByRole('heading', { name: longTitle });
        expect(heading.className).not.toContain('truncate');
    });

    it('shows edit and delete actions for the owner', async () => {
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        expect(screen.getByLabelText('Edit recipe')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete recipe')).toBeInTheDocument();
    });

    it('hides the cover image while in ingredient-select mode', async () => {
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        expect(screen.getByTestId('cover-image')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Toggle Select Mode'));

        expect(screen.queryByTestId('cover-image')).not.toBeInTheDocument();
    });

    it('hides edit and delete actions while in ingredient-select mode and restores them after', async () => {
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        fireEvent.click(screen.getByText('Toggle Select Mode'));

        expect(screen.queryByLabelText('Edit recipe')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Delete recipe')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Toggle Select Mode'));

        expect(screen.getByLabelText('Edit recipe')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete recipe')).toBeInTheDocument();
    });

    it('hides an open title editor while in ingredient-select mode', async () => {
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        fireEvent.click(screen.getByLabelText('Edit recipe'));
        expect(screen.getByLabelText('Recipe title')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Toggle Select Mode'));

        expect(screen.queryByLabelText('Recipe title')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Pasta' })).toBeInTheDocument();
    });

    it('entering edit mode shows title input plus one Save and one Cancel', async () => {
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            link: 'https://example.com/pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        fireEvent.click(screen.getByLabelText('Edit recipe'));

        expect(screen.getByLabelText('Recipe title')).toHaveValue('Pasta');
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('Save assembles the edited title and link plus the recipe’s other fields into one updateRecipe call', async () => {
        mockUpdateRecipe.mockResolvedValue({});
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            link: 'https://example.com/pasta',
            instructions: ['Boil water'],
            tags: ['dinner'],
            ingredients: [{ id: 'i1', name: 'Flour' }],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        fireEvent.click(screen.getByLabelText('Edit recipe'));
        fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Pasta v2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(screen.queryByLabelText('Recipe title')).not.toBeInTheDocument());
        expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
        expect(mockUpdateRecipe).toHaveBeenCalledWith(
            'recipe-1',
            'Pasta v2',
            mockRecipe.ingredients,
            undefined,
            'https://example.com/pasta',
            ['Boil water'],
            ['dinner'],
            undefined,
            undefined,
            undefined,
            undefined
        );
    });

    it('Cancel exits edit mode without calling updateRecipe', async () => {
        mockRecipe = {
            id: 'recipe-1',
            title: 'Pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [{ id: 'user-1', username: 'testuser' }],
            dateAdded: new Date(),
        };

        renderPage();

        await screen.findByRole('heading', { name: 'Pasta' });
        fireEvent.click(screen.getByLabelText('Edit recipe'));
        fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Discarded' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.getByRole('heading', { name: 'Pasta' })).toBeInTheDocument();
        expect(mockUpdateRecipe).not.toHaveBeenCalled();
    });
});
