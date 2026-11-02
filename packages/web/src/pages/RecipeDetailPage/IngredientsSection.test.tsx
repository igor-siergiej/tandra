import type { Ingredient, Recipe } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IngredientsSection } from './IngredientsSection';

vi.mock('../../hooks/useItemImage', () => ({
    useItemImage: () => ({
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        onImageLoad: vi.fn(),
        onImageError: vi.fn(),
    }),
}));

const makeRecipe = (ingredients: Ingredient[]): Recipe => ({
    id: 'r1',
    title: 'Soup',
    ingredients,
    users: [],
    dateAdded: new Date(),
});

describe('IngredientsSection', () => {
    it('deletes an ingredient silently — no success toast for this action', async () => {
        const onUpdateIngredients = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();

        render(
            <IngredientsSection
                recipe={makeRecipe([{ id: 'i1', name: 'Tomato' }])}
                isOwner
                onUpdateIngredients={onUpdateIngredients}
            />
        );

        await user.click(screen.getByLabelText('Delete Tomato'));

        expect(onUpdateIngredients).toHaveBeenCalledWith([], { silent: true });
    });

    it('does not change edit-ingredient toast behaviour', async () => {
        const onUpdateIngredients = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();

        render(
            <IngredientsSection
                recipe={makeRecipe([{ id: 'i1', name: 'Tomato' }])}
                isOwner
                onUpdateIngredients={onUpdateIngredients}
            />
        );

        await user.click(screen.getByLabelText('Edit Tomato'));
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(onUpdateIngredients).toHaveBeenCalledTimes(1);
        expect(onUpdateIngredients.mock.calls[0]).toHaveLength(1);
        expect(onUpdateIngredients.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'i1', name: 'Tomato' })]);
    });

    it('restores the ingredient list if the delete fails', async () => {
        const onUpdateIngredients = vi.fn().mockRejectedValue(new Error('boom'));
        const user = userEvent.setup();

        render(
            <IngredientsSection
                recipe={makeRecipe([{ id: 'i1', name: 'Tomato' }])}
                isOwner
                onUpdateIngredients={onUpdateIngredients}
            />
        );

        await user.click(screen.getByLabelText('Delete Tomato'));

        expect(await screen.findByLabelText('Delete Tomato')).toBeInTheDocument();
    });
});
