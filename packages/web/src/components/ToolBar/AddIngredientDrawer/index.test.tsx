import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AddIngredientDrawer } from './index';

describe('AddIngredientDrawer', () => {
    it('renders the default round trigger when none is provided', () => {
        render(<AddIngredientDrawer open={false} onOpenChange={vi.fn()} onAdd={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Add ingredient' })).toBeInTheDocument();
    });

    it('renders a custom trigger when provided', () => {
        render(
            <AddIngredientDrawer
                open={false}
                onOpenChange={vi.fn()}
                onAdd={vi.fn()}
                trigger={<button type="button">Custom Add Trigger</button>}
            />
        );

        expect(screen.getByRole('button', { name: 'Custom Add Trigger' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add ingredient' })).not.toBeInTheDocument();
    });

    it('calls onAdd with the entered name, quantity, and unit', async () => {
        const user = userEvent.setup();
        const onAdd = vi.fn().mockResolvedValue(undefined);
        const onOpenChange = vi.fn();
        render(<AddIngredientDrawer open onOpenChange={onOpenChange} onAdd={onAdd} />);

        await user.type(screen.getByPlaceholderText('Enter ingredient name...'), 'Flour');
        await user.click(screen.getByRole('button', { name: 'Add Ingredient' }));

        expect(onAdd).toHaveBeenCalledWith('Flour', undefined, undefined);
    });
});
