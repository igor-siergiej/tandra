'use client';

import type { ListResponse, Recipe } from '@tandra/types';
import { ListType } from '@tandra/types';
import { useState } from 'react';

import { IngredientSelectRow } from '../../components/IngredientSelectRow';
import { PortionsStepper } from '../../components/PortionsStepper';
import { Button } from '../../components/ui/button';
import { useIngredientSelection } from '../../hooks/useIngredientSelection';

interface IngredientSelectSectionProps {
    recipe: Recipe;
    lists: ListResponse[];
    onCancel: () => void;
    onConfirm: (
        listTitle: string,
        items: Array<{ itemName: string; quantity?: number; unit?: string }>
    ) => Promise<void>;
}

// fallow-ignore-next-line complexity
export const IngredientSelectSection = ({ recipe, lists, onCancel, onConfirm }: IngredientSelectSectionProps) => {
    const { selectedIds, toggleIngredient, portions, setPortions, scaledIngredients, selectedScaledIngredients } =
        useIngredientSelection(recipe.ingredients, recipe.servings ?? 1);

    const [chosenList, setChosenList] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const shoppingLists = lists.filter((list) => list.listType === ListType.SHOPPING);

    const handleConfirm = async () => {
        if (!chosenList || selectedIds.size === 0) return;

        try {
            setIsLoading(true);
            await onConfirm(
                chosenList,
                selectedScaledIngredients.map((ingredient) => ({
                    itemName: ingredient.name,
                    quantity: ingredient.quantity,
                    unit: ingredient.unit,
                }))
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Select Ingredients</h3>
                {recipe.ingredients.length > 0 && <PortionsStepper value={portions} onChange={setPortions} min={1} />}
                <div className="grid gap-2">
                    {scaledIngredients.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-3">No ingredients to add</p>
                    ) : (
                        scaledIngredients.map((ingredient) => (
                            <IngredientSelectRow
                                key={ingredient.id}
                                ingredient={ingredient}
                                isSelected={selectedIds.has(ingredient.id)}
                                onToggle={toggleIngredient}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* List Selection */}
            {shoppingLists.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Add to List</h3>
                    <div className="flex flex-wrap gap-2">
                        {shoppingLists.map((list) => (
                            <button
                                key={list.id}
                                onClick={() => setChosenList(list.id)}
                                className={`px-4 py-2 rounded-full border font-medium transition-all ${
                                    chosenList === list.id
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-muted border-muted-foreground/30 text-foreground hover:bg-muted/80'
                                }`}
                                type="button"
                            >
                                {list.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* CTA Section */}
            <div className="pt-4 border-t flex gap-2 sticky bottom-0 bg-background">
                <Button onClick={onCancel} variant="outline" className="flex-1" disabled={isLoading} type="button">
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={selectedIds.size === 0 || !chosenList || isLoading}
                    className="flex-1"
                    type="button"
                >
                    Add {selectedIds.size} items
                </Button>
            </div>
        </div>
    );
};
