import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddFromRecipeDrawer } from './index';

let mockRecipes: unknown[] = [];

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: mockRecipes }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../../auth', () => ({
    useUser: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../../hooks/useItemImage', () => ({
    useItemImage: vi.fn(() => ({
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        onImageLoad: vi.fn(),
        onImageError: vi.fn(),
    })),
}));

const mockAddItemsBulk = vi.fn().mockResolvedValue({ added: 1, skipped: 0 });

vi.mock('../../../api', () => ({
    getRecipesQuery: () => ({ queryKey: ['recipes'], queryFn: async () => [] }),
    addItemsBulk: (...args: unknown[]) => mockAddItemsBulk(...args),
}));

describe('AddFromRecipeDrawer', () => {
    const noop = () => {};

    beforeEach(() => {
        mockRecipes = [];
        mockAddItemsBulk.mockClear();
    });

    it('renders its own trigger button by default', () => {
        render(<AddFromRecipeDrawer open={false} onOpenChange={noop} listTitle="Groceries" listItems={[]} />);
        expect(screen.getByLabelText('Add from recipe')).toBeInTheDocument();
    });

    it('hides its trigger button when hideTrigger is true', () => {
        render(
            <AddFromRecipeDrawer open={false} onOpenChange={noop} listTitle="Groceries" listItems={[]} hideTrigger />
        );
        expect(screen.queryByLabelText('Add from recipe')).not.toBeInTheDocument();
    });

    it('renders the recipe search input with autofill-safe attributes', () => {
        render(<AddFromRecipeDrawer open onOpenChange={noop} listTitle="Groceries" listItems={[]} />);

        const searchInput = screen.getByPlaceholderText('Search recipes...');
        expect(searchInput).toHaveAttribute('autocomplete', 'off');
        expect(searchInput).toHaveAttribute('name', 'add-from-recipe-search');
        expect(searchInput).toHaveAttribute('inputmode', 'search');
        expect(searchInput).toHaveAttribute('type', 'search');
    });
});

describe('AddFromRecipeDrawer ingredients step', () => {
    const noop = () => {};

    beforeEach(() => {
        mockAddItemsBulk.mockClear();
    });

    const selectRecipe = async (title: string) => {
        await userEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
    };

    it('defaults the portions stepper to the chosen recipe servings and scales quantities live', async () => {
        mockRecipes = [
            {
                id: 'r1',
                title: 'Soup',
                servings: 4,
                ingredients: [{ id: 'i1', name: 'Carrot', quantity: 2, unit: 'cups' }],
            },
        ];
        render(<AddFromRecipeDrawer open onOpenChange={noop} listTitle="Groceries" listItems={[]} />);

        await selectRecipe('Soup');

        expect(screen.getByTestId('portions-value')).toHaveTextContent('4');
        expect(screen.getByText('2 cups')).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Increase portions'));

        expect(screen.getByTestId('portions-value')).toHaveTextContent('5');
        expect(screen.getByText('2.5 cups')).toBeInTheDocument();
    });

    it('defaults portions to 1 when the recipe has no servings field', async () => {
        mockRecipes = [
            { id: 'r1', title: 'Soup', ingredients: [{ id: 'i1', name: 'Carrot', quantity: 2, unit: 'cups' }] },
        ];
        render(<AddFromRecipeDrawer open onOpenChange={noop} listTitle="Groceries" listItems={[]} />);

        await selectRecipe('Soup');

        expect(screen.getByTestId('portions-value')).toHaveTextContent('1');
    });

    it('sends scaled quantities to addItemsBulk for selected ingredients', async () => {
        mockRecipes = [
            {
                id: 'r1',
                title: 'Soup',
                servings: 4,
                ingredients: [{ id: 'i1', name: 'Carrot', quantity: 2, unit: 'cups' }],
            },
        ];
        render(<AddFromRecipeDrawer open onOpenChange={noop} listTitle="Groceries" listItems={[]} />);

        await selectRecipe('Soup');
        await userEvent.click(screen.getByLabelText('Increase portions'));
        await userEvent.click(screen.getByText('Carrot'));
        await userEvent.click(screen.getByRole('button', { name: /Add 1 items/ }));

        expect(mockAddItemsBulk).toHaveBeenCalledWith('Groceries', [
            { itemName: 'Carrot', quantity: 2.5, unit: 'cups' },
        ]);
    });

    it('resets portions to the new recipe baseline when switching recipes', async () => {
        mockRecipes = [
            {
                id: 'r1',
                title: 'Soup',
                servings: 4,
                ingredients: [{ id: 'i1', name: 'Carrot', quantity: 2, unit: 'cups' }],
            },
            {
                id: 'r2',
                title: 'Stew',
                servings: 2,
                ingredients: [{ id: 'i2', name: 'Onion', quantity: 1, unit: 'cups' }],
            },
        ];
        render(<AddFromRecipeDrawer open onOpenChange={noop} listTitle="Groceries" listItems={[]} />);

        await selectRecipe('Soup');
        expect(screen.getByTestId('portions-value')).toHaveTextContent('4');

        await userEvent.click(screen.getByLabelText('Back to recipes'));
        await selectRecipe('Stew');

        expect(screen.getByTestId('portions-value')).toHaveTextContent('2');
        expect(screen.getByText('1 cups')).toBeInTheDocument();
    });
});
