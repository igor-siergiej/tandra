import type { Recipe } from '@tandra/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useIngredientWasteSearch } from './useIngredientWasteSearch';

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
        title: 'Tomato Soup',
        ingredients: [
            { id: 'i5', name: 'tomato' },
            { id: 'i6', name: 'basil' },
        ],
        tags: ['comfort-food'],
    }),
];

describe('useIngredientWasteSearch', () => {
    it('returns an empty array when the query is empty', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, ''));
        expect(result.current).toHaveLength(0);
    });

    it('returns an empty array when the query is whitespace only', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, '   '));
        expect(result.current).toHaveLength(0);
    });

    it('matches every recipe that uses the ingredient', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'tomato'));
        const titles = result.current.map((m) => m.recipe.title);
        expect(titles).toContain('Chicken Tikka Masala');
        expect(titles).toContain('Tomato Soup');
        expect(titles).not.toContain('Pasta Carbonara');
    });

    it('does not match on title alone — only ingredients.name', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'carbonara'));
        expect(result.current).toHaveLength(0);
    });

    it('tolerates a typo in the ingredient name', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'tomatoe'));
        expect(result.current.length).toBeGreaterThan(0);
        expect(result.current.map((m) => m.recipe.title)).toContain('Tomato Soup');
    });

    it('is case-insensitive', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'CHICKEN'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].recipe.title).toBe('Chicken Tikka Masala');
    });

    it('surfaces the matched ingredient name alongside the recipe', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'spaghetti'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].matchedIngredientName).toBe('spaghetti');
    });

    it('sorts results by match score, best match first', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'tomato'));
        for (let i = 1; i < result.current.length; i++) {
            expect(result.current[i].score).toBeGreaterThanOrEqual(result.current[i - 1].score);
        }
    });

    it('returns an empty array when no recipe uses anything like the ingredient', () => {
        const { result } = renderHook(() => useIngredientWasteSearch(recipes, 'zzzzzzzzz'));
        expect(result.current).toHaveLength(0);
    });
});
