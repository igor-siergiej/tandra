import type { ListResponse } from '@tandra/types';
import { ListType } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { AddIngredientsFromListDrawer } from './AddIngredientsFromListDrawer';

const shoppingList: ListResponse = {
    id: 'list-1',
    title: 'Weekly Shop',
    dateAdded: new Date(),
    listType: ListType.SHOPPING,
    users: [],
    items: [
        { id: 'item-1', name: 'Flour', isSelected: false, dateAdded: new Date(), quantity: 500, unit: 'g' },
        { id: 'item-2', name: 'Eggs', isSelected: false, dateAdded: new Date() },
    ],
};

describe('AddIngredientsFromListDrawer', () => {
    it('lets the user pick a list then selected items merge in as ingredients', async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn();
        render(<AddIngredientsFromListDrawer lists={[shoppingList]} onAdd={onAdd} />);

        await user.click(screen.getByRole('button', { name: /add from shopping list/i }));
        await user.click(screen.getByRole('button', { name: 'Weekly Shop' }));
        await user.click(screen.getByText('Flour'));
        await user.click(screen.getByRole('button', { name: /add 1 ingredient/i }));

        expect(onAdd).toHaveBeenCalledWith([{ name: 'Flour', quantity: 500, unit: 'g' }]);
    });

    it('only offers shopping-type lists', async () => {
        const user = userEvent.setup();
        const otherList: ListResponse = { ...shoppingList, id: 'list-2', title: 'Not Shopping', items: [] };
        render(
            <AddIngredientsFromListDrawer
                lists={[shoppingList, { ...otherList, listType: 'other' as ListType }]}
                onAdd={vi.fn()}
            />
        );

        await user.click(screen.getByRole('button', { name: /add from shopping list/i }));

        expect(screen.getByRole('button', { name: 'Weekly Shop' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Not Shopping' })).not.toBeInTheDocument();
    });

    it('shows an empty state when there are no shopping lists', async () => {
        const user = userEvent.setup();
        render(<AddIngredientsFromListDrawer lists={[]} onAdd={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /add from shopping list/i }));

        expect(screen.getByText(/no shopping lists yet/i)).toBeInTheDocument();
    });

    it('disables confirm until at least one item is selected', async () => {
        const user = userEvent.setup();
        render(<AddIngredientsFromListDrawer lists={[shoppingList]} onAdd={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /add from shopping list/i }));
        await user.click(screen.getByRole('button', { name: 'Weekly Shop' }));

        expect(screen.getByRole('button', { name: /add 0 ingredients/i })).toBeDisabled();
    });
});
