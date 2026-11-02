import type { Ingredient, Recipe } from '@tandra/types';
import { useEffect, useState } from 'react';

import IngredientItem from '../../components/IngredientItem';

interface IngredientsSectionProps {
    recipe: Recipe;
    isOwner?: boolean;
    onUpdateIngredients: (ingredients: Ingredient[], options?: { silent?: boolean }) => Promise<void>;
}

export const IngredientsSection = ({ recipe, isOwner = false, onUpdateIngredients }: IngredientsSectionProps) => {
    const [ingredients, setIngredients] = useState<Ingredient[]>(recipe.ingredients);

    useEffect(() => {
        setIngredients(recipe.ingredients);
    }, [recipe.ingredients]);

    const handleDeleteIngredient = async (id: string) => {
        const updated = ingredients.filter((ing) => ing.id !== id);
        setIngredients(updated);

        try {
            // No success toast for a single-ingredient delete — the error toast (on failure)
            // already comes from onUpdateIngredients, so this stays silent on the happy path.
            await onUpdateIngredients(updated, { silent: true });
        } catch (error) {
            // Restore the original ingredients on error
            setIngredients(ingredients);
            throw error;
        }
    };

    const handleEditIngredient = async (id: string, updated: Ingredient) => {
        const newIngredients = ingredients.map((ing) => (ing.id === id ? updated : ing));
        setIngredients(newIngredients);

        try {
            await onUpdateIngredients(newIngredients);
        } catch {
            setIngredients(ingredients);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ingredients ({ingredients.length})</h3>

            {ingredients.length === 0 ? (
                <p className="text-muted-foreground text-sm py-3">No ingredients added yet</p>
            ) : (
                <div className="space-y-2">
                    {ingredients.map((ingredient) => (
                        <IngredientItem
                            key={ingredient.id}
                            ingredient={ingredient}
                            onDelete={handleDeleteIngredient}
                            onEdit={handleEditIngredient}
                            isOwner={isOwner}
                            recipeTitle={recipe.title}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
