import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { DraftIngredientRow } from './DraftIngredientRow';

vi.mock('../../hooks/useItemImage', () => ({
    useItemImage: () => ({
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        onImageLoad: vi.fn(),
        onImageError: vi.fn(),
    }),
}));

describe('DraftIngredientRow', () => {
    it('shows the ingredient name with quantity and unit', () => {
        render(
            <DraftIngredientRow
                ingredient={{ name: 'Flour', quantity: 500, unit: 'g' }}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(screen.getByText('Flour')).toBeInTheDocument();
        expect(screen.getByText('500 g')).toBeInTheDocument();
    });

    it('shows just the name when there is no quantity or unit', () => {
        render(<DraftIngredientRow ingredient={{ name: 'Salt' }} onEdit={vi.fn()} onDelete={vi.fn()} />);

        expect(screen.getByText('Salt')).toBeInTheDocument();
    });

    it('calls onEdit when the edit button is pressed', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn();
        render(<DraftIngredientRow ingredient={{ name: 'Flour' }} onEdit={onEdit} onDelete={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Edit Flour' }));

        expect(onEdit).toHaveBeenCalled();
    });

    it('calls onDelete when the delete button is pressed', async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();
        render(<DraftIngredientRow ingredient={{ name: 'Flour' }} onEdit={vi.fn()} onDelete={onDelete} />);

        await user.click(screen.getByRole('button', { name: 'Delete Flour' }));

        expect(onDelete).toHaveBeenCalled();
    });
});
