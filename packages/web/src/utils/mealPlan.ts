import type { Ingredient, MealPlanEntry, Recipe } from '@tandra/types';
import { addDays, format, startOfWeek } from 'date-fns';

import { scaleIngredients } from './convertUnits';

const DAY_FORMAT = 'yyyy-MM-dd';

/** Monday of the week containing `date`. */
export const weekStart = (date: Date): Date => startOfWeek(date, { weekStartsOn: 1 });

export const weekDays = (start: Date): Array<Date> => Array.from({ length: 7 }, (_, offset) => addDays(start, offset));

export const dayKey = (date: Date): string => format(date, DAY_FORMAT);

export interface ShoppingRow {
    key: string;
    name: string;
    quantity?: number;
    unit?: string;
    recipeTitle: string;
}

/**
 * One row per ingredient of every planned recipe, scaled from the recipe's own portions to the planned portions.
 * Duplicates across recipes are left as separate rows on purpose: the list's add-items endpoint merges them with its
 * ingredient matching, so the preview shows what will be sent rather than a second, divergent merge.
 */
export const buildShoppingRows = (entries: Array<MealPlanEntry>, recipes: Array<Recipe>): Array<ShoppingRow> => {
    const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

    return entries.flatMap((entry) => {
        const recipe = byId.get(entry.recipeId);

        if (!recipe) return [];
        const baseline = recipe.servings && recipe.servings > 0 ? recipe.servings : entry.servings;
        const scaled: Array<Ingredient> = scaleIngredients(recipe.ingredients, entry.servings / baseline);

        return scaled.map((ingredient) => ({
            key: `${entry.id}:${ingredient.id}`,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            recipeTitle: recipe.title,
        }));
    });
};
