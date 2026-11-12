import type { Ingredient } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import IngredientItem from './index';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../hooks/useItemImage', () => ({
    useItemImage: () => ({
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        onImageLoad: vi.fn(),
        onImageError: vi.fn(),
    }),
}));

const ingredient: Ingredient = { id: 'i1', name: 'Tomato' };

describe('IngredientItem', () => {
    it('shows no toast when deleting succeeds — the caller owns success feedback', async () => {
        const { toast } = await import('sonner');
        const onDelete = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();

        render(<IngredientItem ingredient={ingredient} onDelete={onDelete} onEdit={vi.fn()} />);
        await user.click(screen.getByLabelText('Delete Tomato'));

        expect(onDelete).toHaveBeenCalledWith('i1');
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('shows no toast itself on delete failure — the caller already shows the error toast', async () => {
        const { toast } = await import('sonner');
        const onDelete = vi.fn().mockRejectedValue(new Error('boom'));
        const user = userEvent.setup();

        render(<IngredientItem ingredient={ingredient} onDelete={onDelete} onEdit={vi.fn()} />);
        await user.click(screen.getByLabelText('Delete Tomato'));

        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
        // Delete/edit buttons re-appear once isDeleting resets on failure.
        expect(await screen.findByLabelText('Delete Tomato')).toBeInTheDocument();
    });
});
