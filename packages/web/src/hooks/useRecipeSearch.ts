import type { Recipe } from '@tandra/types';
import Fuse from 'fuse.js';
import { useMemo } from 'react';

export const useRecipeSearch = (recipes: Recipe[], query: string): Recipe[] => {
    const trimmed = query.trim();

    const fuse = useMemo(
        () =>
            new Fuse(recipes, {
                keys: ['title', 'ingredients.name', 'tags'],
                threshold: 0.4,
            }),
        [recipes]
    );

    return useMemo(() => {
        if (!trimmed) return recipes;

        return fuse.search(trimmed).map((r) => r.item);
    }, [fuse, trimmed, recipes]);
};
