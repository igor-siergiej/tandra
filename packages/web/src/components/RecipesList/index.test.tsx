import type { Recipe } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecipesList } from './index';

vi.mock('../RecipeCard', () => ({
    RecipeCard: ({
        recipe,
        currentUserId,
        onClick,
    }: {
        recipe: Recipe;
        currentUserId: string;
        onClick: () => void;
    }) => (
        <button type="button" data-testid={`recipe-${recipe.id}`} data-current-user={currentUserId} onClick={onClick}>
            {recipe.title}
        </button>
    ),
}));

describe('RecipesList', () => {
    const recipes: Recipe[] = [
        { id: 'r1', title: 'Owned', ownerId: 'user-1', users: [], ingredients: [], dateAdded: new Date() },
        { id: 'r2', title: 'Shared', ownerId: 'user-2', users: [], ingredients: [], dateAdded: new Date() },
    ];

    it('passes currentUserId down to each RecipeCard', () => {
        render(<RecipesList recipes={recipes} currentUserId="user-1" onRecipeClick={vi.fn()} />);

        expect(screen.getByTestId('recipe-r1')).toHaveAttribute('data-current-user', 'user-1');
        expect(screen.getByTestId('recipe-r2')).toHaveAttribute('data-current-user', 'user-1');
    });
});
