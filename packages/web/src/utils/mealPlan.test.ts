import type { MealPlanEntry, Recipe } from '@tandra/types';
import { describe, expect, it } from 'vitest';

import { buildShoppingRows, dayKey, weekDays, weekStart } from './mealPlan';

const entry = (over: Partial<MealPlanEntry>): MealPlanEntry => ({
    id: 'e1',
    ownerId: 'u1',
    date: '2026-10-12',
    recipeId: 'r1',
    servings: 4,
    dateAdded: new Date(),
    ...over,
});

const recipe = (over: Partial<Recipe> = {}): Recipe =>
    ({
        id: 'r1',
        title: 'Pasta',
        servings: 2,
        users: [],
        ownerId: 'u1',
        ingredients: [
            { id: 'a', name: 'spaghetti', quantity: 200, unit: 'g' },
            { id: 'b', name: 'garlic' },
        ],
        ...over,
    }) as Recipe;

describe('week helpers', () => {
    it('starts the week on Monday', () => {
        expect(dayKey(weekStart(new Date(2026, 9, 14)))).toBe('2026-10-12');
        expect(dayKey(weekStart(new Date(2026, 9, 18)))).toBe('2026-10-12');
    });

    it('lists seven consecutive days', () => {
        const days = weekDays(weekStart(new Date(2026, 9, 14))).map(dayKey);

        expect(days[0]).toBe('2026-10-12');
        expect(days[6]).toBe('2026-10-18');
        expect(days).toHaveLength(7);
    });
});

describe('buildShoppingRows', () => {
    it('scales quantities from the recipe portions to the planned portions', () => {
        const [spaghetti, garlic] = buildShoppingRows([entry({ servings: 4 })], [recipe()]);

        expect(spaghetti).toMatchObject({ name: 'spaghetti', quantity: 400, unit: 'g', recipeTitle: 'Pasta' });
        expect(garlic.quantity).toBeUndefined();
    });

    it('treats a recipe without servings as already at the planned portions', () => {
        const [spaghetti] = buildShoppingRows([entry({ servings: 3 })], [recipe({ servings: undefined })]);

        expect(spaghetti.quantity).toBe(200);
    });

    it('keeps the same ingredient from two plans as separate rows for the server to merge', () => {
        const rows = buildShoppingRows([entry({ id: 'e1' }), entry({ id: 'e2', date: '2026-10-13' })], [recipe()]);

        expect(rows.filter((row) => row.name === 'spaghetti')).toHaveLength(2);
        expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    });

    it('skips plans whose recipe is no longer visible', () => {
        expect(buildShoppingRows([entry({ recipeId: 'gone' })], [recipe()])).toEqual([]);
    });
});
