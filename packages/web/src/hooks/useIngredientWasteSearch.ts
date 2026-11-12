import type { Recipe } from '@tandra/types';
import Fuse from 'fuse.js';
import { useMemo } from 'react';

export interface IngredientWasteMatch {
    recipe: Recipe;
    matchedIngredientName: string;
    score: number;
}

// Scoped to ingredients.name only (unlike useRecipeSearch's title/ingredients/tags), and keeps
// Fuse's match score + matched ingredient text so callers can rank results and show which
// ingredient matched, instead of just the recipe list useRecipeSearch returns.
export const useIngredientWasteSearch = (recipes: Recipe[], query: string): IngredientWasteMatch[] => {
    const trimmed = query.trim();

    const fuse = useMemo(
        () =>
            new Fuse(recipes, {
                keys: ['ingredients.name'],
                threshold: 0.4,
                includeScore: true,
                includeMatches: true,
            }),
        [recipes]
    );

    return useMemo(() => {
        if (!trimmed) return [];

        // fallow-ignore-next-line complexity
        return fuse.search(trimmed).map((result) => ({
            recipe: result.item,
            matchedIngredientName: result.matches?.[0]?.value ?? result.item.ingredients[0]?.name ?? '',
            score: result.score ?? 1,
        }));
    }, [fuse, trimmed]);
};
