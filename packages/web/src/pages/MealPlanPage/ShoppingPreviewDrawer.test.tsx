import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ShoppingRow } from '../../utils/mealPlan';
import { ShoppingPreviewDrawer } from './ShoppingPreviewDrawer';

vi.mock('../../components/ui/drawer', () => ({
    Drawer: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: any) => <div>{children}</div>,
    DrawerHeader: ({ children }: any) => <div>{children}</div>,
    DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
    DrawerFooter: ({ children }: any) => <div>{children}</div>,
}));

const rows: ShoppingRow[] = [
    { key: 'a', name: 'spaghetti', quantity: 400, unit: 'g', recipeTitle: 'Pasta' },
    { key: 'b', name: 'garlic', recipeTitle: 'Pasta' },
];
const lists = [
    { id: 'l1', title: 'Weekly' },
    { id: 'l2', title: 'Party' },
] as never;

const setup = (onConfirm = vi.fn().mockResolvedValue(undefined)) => {
    const onOpenChange = vi.fn();
    render(
        <ShoppingPreviewDrawer
            open
            rangeLabel="12 Oct – 18 Oct"
            rows={rows}
            lists={lists}
            onConfirm={onConfirm}
            onOpenChange={onOpenChange}
        />
    );
    return { onConfirm, onOpenChange };
};

describe('ShoppingPreviewDrawer', () => {
    it('previews every scaled ingredient and adds them to the first list by default', async () => {
        const { onConfirm, onOpenChange } = setup();

        expect(screen.getByText('400 g')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Add 2 ingredients' }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('l1', rows));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('adds to the chosen list and only the ticked rows', async () => {
        const { onConfirm } = setup();

        fireEvent.change(screen.getByLabelText('Add to list'), { target: { value: 'l2' } });
        fireEvent.click(screen.getByRole('checkbox', { name: /garlic/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Add 1 ingredient' }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('l2', [rows[0]]));
    });

    it('keeps the drawer open and shows the failure', async () => {
        const { onOpenChange } = setup(vi.fn().mockRejectedValue(new Error('List not found')));

        fireEvent.click(screen.getByRole('button', { name: 'Add 2 ingredients' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('List not found');
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
});
