import type { Ingredient } from '@tandra/types';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { useIngredientSelection } from './useIngredientSelection';

const ingredients: Ingredient[] = [
    { id: 'i1', name: 'Carrot', quantity: 2, unit: 'cups' },
    { id: 'i2', name: 'Salt' },
];

describe('useIngredientSelection', () => {
    it('starts with no selection and portions at the given baseline', () => {
        const { result } = renderHook(() => useIngredientSelection(ingredients, 4));

        expect(result.current.selectedIds.size).toBe(0);
        expect(result.current.portions).toBe(4);
        expect(result.current.scaledIngredients).toEqual(ingredients);
    });

    it('toggles ingredient selection on and off', () => {
        const { result } = renderHook(() => useIngredientSelection(ingredients, 1));

        act(() => result.current.toggleIngredient('i1'));
        expect(result.current.selectedIds.has('i1')).toBe(true);

        act(() => result.current.toggleIngredient('i1'));
        expect(result.current.selectedIds.has('i1')).toBe(false);
    });

    it('scales ingredient quantities as portions change relative to the baseline, leaving quantity-less ingredients untouched', () => {
        const { result } = renderHook(() => useIngredientSelection(ingredients, 4));

        act(() => result.current.setPortions(6));

        expect(result.current.scaledIngredients).toEqual([
            { id: 'i1', name: 'Carrot', quantity: 3, unit: 'cups' },
            { id: 'i2', name: 'Salt' },
        ]);
    });

    it('derives selectedScaledIngredients from the current selection and scaling', () => {
        const { result } = renderHook(() => useIngredientSelection(ingredients, 4));

        act(() => {
            result.current.setPortions(8);
            result.current.toggleIngredient('i1');
        });

        expect(result.current.selectedScaledIngredients).toEqual([
            { id: 'i1', name: 'Carrot', quantity: 4, unit: 'cups' },
        ]);
    });

    it('reset clears the selection and re-seeds portions to a new baseline', () => {
        const { result } = renderHook(() => useIngredientSelection(ingredients, 4));

        act(() => {
            result.current.toggleIngredient('i1');
            result.current.setPortions(8);
        });
        expect(result.current.selectedIds.size).toBe(1);

        act(() => result.current.reset(2));

        expect(result.current.selectedIds.size).toBe(0);
        expect(result.current.portions).toBe(2);
    });
});
