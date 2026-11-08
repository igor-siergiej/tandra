import type { Recipe } from '@tandra/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useRecipeSearch } from './useRecipeSearch';

const makeRecipe = (overrides: Partial<Recipe> & { id: string; title: string }): Recipe => ({
    ingredients: [],
    users: [],
    dateAdded: new Date(),
    ...overrides,
});

const recipes: Recipe[] = [
    makeRecipe({
        id: '1',
        title: 'Chicken Tikka Masala',
        ingredients: [
            { id: 'i1', name: 'chicken' },
            { id: 'i2', name: 'tomato' },
        ],
    }),
    makeRecipe({
        id: '2',
        title: 'Pasta Carbonara',
        ingredients: [
            { id: 'i3', name: 'spaghetti' },
            { id: 'i4', name: 'egg' },
        ],
    }),
    makeRecipe({
        id: '3',
        title: 'Beef Stew',
        ingredients: [
            { id: 'i5', name: 'beef' },
            { id: 'i6', name: 'carrot' },
        ],
        tags: ['comfort-food', 'hearty'],
    }),
];

describe('useRecipeSearch', () => {
    it('returns all recipes when query is empty', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, ''));
        expect(result.current).toHaveLength(3);
    });

    it('filters recipes by exact title match', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'Pasta Carbonara'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].title).toBe('Pasta Carbonara');
    });

    it('filters recipes by partial title match', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'tikka'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].title).toBe('Chicken Tikka Masala');
    });

    it('matches recipes by ingredient name', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'spaghetti'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].title).toBe('Pasta Carbonara');
    });

    it('finds recipes with fuzzy/misspelled title', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'chiken'));
        expect(result.current.length).toBeGreaterThan(0);
        expect(result.current[0].title).toBe('Chicken Tikka Masala');
    });

    it('finds recipes with fuzzy/misspelled ingredient', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'tomatoe'));
        expect(result.current.length).toBeGreaterThan(0);
        expect(result.current[0].title).toBe('Chicken Tikka Masala');
    });

    it('returns empty array when no recipes match', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'zzzzzzzzz'));
        expect(result.current).toHaveLength(0);
    });

    it('is case-insensitive', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'BEEF'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].title).toBe('Beef Stew');
    });

    it('matches recipes by tag, even when the tag is absent from title and ingredients', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, 'comfort-food'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].title).toBe('Beef Stew');
    });

    it('returns all recipes when query is whitespace only', () => {
        const { result } = renderHook(() => useRecipeSearch(recipes, '   '));
        expect(result.current).toHaveLength(3);
    });
});
