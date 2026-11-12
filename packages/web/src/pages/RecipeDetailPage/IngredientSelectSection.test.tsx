import type { ListResponse, Recipe } from '@tandra/types';
import { ListType } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { IngredientSelectSection } from './IngredientSelectSection';

vi.mock('../../hooks/useItemImage', () => ({
    useItemImage: vi.fn(() => ({
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        onImageLoad: vi.fn(),
        onImageError: vi.fn(),
    })),
}));

const list: ListResponse = {
    id: 'list-1',
    title: 'Groceries',
    dateAdded: new Date('2024-01-01'),
    listType: ListType.SHOPPING,
    items: [],
    users: [],
};

const buildRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'recipe-1',
    title: 'Soup',
    dateAdded: new Date('2024-01-01'),
    ingredients: [
        { id: 'i1', name: 'Carrot', quantity: 2, unit: 'cups' },
        { id: 'i2', name: 'Salt' },
    ],
    instructions: [],
    users: [],
    ...overrides,
});

describe('IngredientSelectSection', () => {
    const noop = () => {};

    it('defaults the portions stepper to the recipe servings', () => {
        render(
            <IngredientSelectSection
                recipe={buildRecipe({ servings: 4 })}
                lists={[list]}
                onCancel={noop}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByTestId('portions-value')).toHaveTextContent('4');
    });

    it('defaults the portions stepper to 1 when the recipe has no servings field', () => {
        render(<IngredientSelectSection recipe={buildRecipe()} lists={[list]} onCancel={noop} onConfirm={vi.fn()} />);

        expect(screen.getByTestId('portions-value')).toHaveTextContent('1');
    });

    it('scales the displayed quantity live as portions change, leaving quantity-less ingredients untouched', async () => {
        render(
            <IngredientSelectSection
                recipe={buildRecipe({ servings: 4 })}
                lists={[list]}
                onCancel={noop}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('2 cups')).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Increase portions'));

        expect(screen.getByTestId('portions-value')).toHaveTextContent('5');
        expect(screen.getByText('2.5 cups')).toBeInTheDocument();
        expect(screen.getByText('Salt')).toBeInTheDocument();
    });

    it('sends scaled quantities to onConfirm for the selected ingredients', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        render(
            <IngredientSelectSection
                recipe={buildRecipe({ servings: 4 })}
                lists={[list]}
                onCancel={noop}
                onConfirm={onConfirm}
            />
        );

        await userEvent.click(screen.getByLabelText('Increase portions'));
        await userEvent.click(screen.getByText('Carrot'));
        await userEvent.click(screen.getByText('Groceries'));
        await userEvent.click(screen.getByRole('button', { name: /Add 1 items/ }));

        expect(onConfirm).toHaveBeenCalledWith('list-1', [{ itemName: 'Carrot', quantity: 2.5, unit: 'cups' }]);
    });

    it('sends unscaled quantities when portions are left at the default', async () => {
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        render(
            <IngredientSelectSection
                recipe={buildRecipe({ servings: 4 })}
                lists={[list]}
                onCancel={noop}
                onConfirm={onConfirm}
            />
        );

        await userEvent.click(screen.getByText('Carrot'));
        await userEvent.click(screen.getByText('Groceries'));
        await userEvent.click(screen.getByRole('button', { name: /Add 1 items/ }));

        expect(onConfirm).toHaveBeenCalledWith('list-1', [{ itemName: 'Carrot', quantity: 2, unit: 'cups' }]);
    });
});
