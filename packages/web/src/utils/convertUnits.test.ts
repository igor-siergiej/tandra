import { describe, expect, it } from 'vite-plus/test';

import { convertIngredients, scaleIngredients } from './convertUnits';

const one = (quantity: number | undefined, unit: string | undefined, system: 'metric' | 'imperial') =>
    convertIngredients([{ name: 'x', quantity, unit }], system)[0];

describe('convertIngredients', () => {
    it('is a no-op for the "original" system (same reference back)', () => {
        const input = [{ name: 'Flour', quantity: 2, unit: 'cups' }];
        expect(convertIngredients(input, 'original')).toBe(input);
    });

    it('converts imperial mass and volume to metric', () => {
        expect(one(1, 'lb', 'metric')).toEqual({ name: 'x', quantity: 454, unit: 'g' });
        expect(one(3, 'lb', 'metric')).toEqual({ name: 'x', quantity: 1.4, unit: 'kg' });
        expect(one(1, 'pint', 'metric')).toEqual({ name: 'x', quantity: 473, unit: 'ml' });
        expect(one(5, 'quarts', 'metric')).toEqual({ name: 'x', quantity: 4.7, unit: 'l' });
    });

    it('converts metric to imperial', () => {
        expect(one(500, 'g', 'imperial')).toEqual({ name: 'x', quantity: 1.1, unit: 'lb' });
        expect(one(30, 'g', 'imperial')).toEqual({ name: 'x', quantity: 1.1, unit: 'oz' });
        expect(one(500, 'ml', 'imperial')).toEqual({ name: 'x', quantity: 1.1, unit: 'pint' });
    });

    it('normalises unit aliases (plural, trailing dot, case)', () => {
        expect(one(2, 'Ounces', 'metric')).toEqual({ name: 'x', quantity: 56.5, unit: 'g' });
        expect(one(1, 'Pint', 'metric')).toEqual({ name: 'x', quantity: 473, unit: 'ml' });
    });

    it('leaves an ingredient untouched when it is already in the target system', () => {
        expect(one(100, 'g', 'metric')).toEqual({ name: 'x', quantity: 100, unit: 'g' });
        expect(one(2, 'pints', 'imperial')).toEqual({ name: 'x', quantity: 2, unit: 'pints' });
    });

    it('leaves tsp/tbsp/cup untouched regardless of target system (not auto-converted)', () => {
        expect(one(1, 'tsp', 'metric')).toEqual({ name: 'x', quantity: 1, unit: 'tsp' });
        expect(one(2, 'tbsp', 'metric')).toEqual({ name: 'x', quantity: 2, unit: 'tbsp' });
        expect(one(1, 'cup', 'metric')).toEqual({ name: 'x', quantity: 1, unit: 'cup' });
        expect(one(1, 'tsp', 'imperial')).toEqual({ name: 'x', quantity: 1, unit: 'tsp' });
        expect(one(2, 'tbsp', 'imperial')).toEqual({ name: 'x', quantity: 2, unit: 'tbsp' });
        expect(one(1, 'cup', 'imperial')).toEqual({ name: 'x', quantity: 1, unit: 'cup' });
    });

    it('leaves an ingredient untouched for unknown units or missing/invalid amounts', () => {
        expect(one(2, 'cloves', 'metric')).toEqual({ name: 'x', quantity: 2, unit: 'cloves' });
        expect(one(undefined, 'oz', 'metric')).toEqual({ name: 'x', quantity: undefined, unit: 'oz' });
        expect(one(0, 'oz', 'metric')).toEqual({ name: 'x', quantity: 0, unit: 'oz' });
        expect(one(Number.NaN, 'oz', 'metric')).toEqual({ name: 'x', quantity: Number.NaN, unit: 'oz' });
    });

    it('converts a mixed ingredient list, touching only what it can', () => {
        const input = [
            { name: 'Flour', quantity: 2, unit: 'cups' },
            { name: 'Butter', quantity: 4, unit: 'oz' },
            { name: 'Garlic', quantity: 2, unit: 'cloves' },
            { name: 'Salt' },
            { name: 'Milk', quantity: 200, unit: 'ml' },
        ];

        expect(convertIngredients(input, 'metric')).toEqual([
            { name: 'Flour', quantity: 2, unit: 'cups' },
            { name: 'Butter', quantity: 113, unit: 'g' },
            { name: 'Garlic', quantity: 2, unit: 'cloves' },
            { name: 'Salt' },
            { name: 'Milk', quantity: 200, unit: 'ml' },
        ]);
    });
});

describe('scaleIngredients', () => {
    it('is a no-op for multiplier 1 (same reference back)', () => {
        const input = [{ name: 'Flour', quantity: 2, unit: 'cups' }];
        expect(scaleIngredients(input, 1)).toBe(input);
    });

    it('scales quantities up and rounds via roundQuantity', () => {
        expect(scaleIngredients([{ name: 'Carrot', quantity: 2, unit: 'cups' }], 1.25)).toEqual([
            { name: 'Carrot', quantity: 2.5, unit: 'cups' },
        ]);
        expect(scaleIngredients([{ name: 'Flour', quantity: 150, unit: 'g' }], 2)).toEqual([
            { name: 'Flour', quantity: 300, unit: 'g' },
        ]);
    });

    it('scales quantities down', () => {
        expect(scaleIngredients([{ name: 'Sugar', quantity: 4, unit: 'tbsp' }], 0.5)).toEqual([
            { name: 'Sugar', quantity: 2, unit: 'tbsp' },
        ]);
    });

    it('leaves ingredients with no quantity untouched', () => {
        expect(scaleIngredients([{ name: 'Salt' }], 2)).toEqual([{ name: 'Salt' }]);
    });

    it('scales a mixed ingredient list, touching only what it can', () => {
        const input = [
            { name: 'Carrot', quantity: 2, unit: 'cups' },
            { name: 'Salt' },
            { name: 'Pepper', quantity: 0.5, unit: 'tsp' },
        ];

        expect(scaleIngredients(input, 3)).toEqual([
            { name: 'Carrot', quantity: 6, unit: 'cups' },
            { name: 'Salt' },
            { name: 'Pepper', quantity: 1.5, unit: 'tsp' },
        ]);
    });
});
