import type { Ingredient } from '@tandra/types';
import { useState } from 'react';

import { scaleIngredients } from '../utils/convertUnits';

/**
 * Shared selection + portions-scaling state for the two "pick ingredients from a recipe
 * and add them to a shopping list" flows (RecipeDetailPage's select mode and
 * ToolBar/AddFromRecipeDrawer). `reset` re-seeds both the selection and the portions
 * baseline — callers that show one fixed recipe for their whole lifetime (e.g.
 * IngredientSelectSection) never need it; callers that swap which recipe is active while
 * mounted (e.g. AddFromRecipeDrawer) call it whenever the active recipe changes.
 */
export const useIngredientSelection = (ingredients: Ingredient[], baselinePortions: number) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [portions, setPortions] = useState(baselinePortions);

    const toggleIngredient = (id: string) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const reset = (nextBaselinePortions: number) => {
        setSelectedIds(new Set());
        setPortions(nextBaselinePortions);
    };

    const multiplier = portions / baselinePortions;
    const scaledIngredients = scaleIngredients(ingredients, multiplier);
    const selectedScaledIngredients = scaledIngredients.filter((ingredient) => selectedIds.has(ingredient.id));

    return {
        selectedIds,
        toggleIngredient,
        portions,
        setPortions,
        scaledIngredients,
        selectedScaledIngredients,
        reset,
    };
};
