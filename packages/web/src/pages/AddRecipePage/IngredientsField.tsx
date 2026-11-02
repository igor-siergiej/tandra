import { Plus } from 'lucide-react';
import { useState } from 'react';

import { AddIngredientDrawer } from '../../components/ToolBar/AddIngredientDrawer';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { useItemEditDrawer } from '../../hooks/useItemEditDrawer';
import { splitIntoSteps } from '../../utils/splitIntoSteps';
import { DraftIngredientRow } from './DraftIngredientRow';
import { IngredientEditDrawer } from './IngredientEditDrawer';

export interface Ingredient {
    name: string;
    quantity?: number;
    unit?: string;
}

interface IngredientsFieldProps {
    ingredients: Ingredient[];
    ingredientsPasteText: string;
    setIngredientsPasteText: (text: string) => void;
    showIngredientsPaste: boolean;
    setShowIngredientsPaste: (show: boolean) => void;
    onChange: (ingredients: Ingredient[]) => void;
    disabled?: boolean;
    isImporting?: boolean;
}

// Paste-textarea/parsed-list toggle for bulk entry, parallel to how StepsList/splitIntoSteps
// handle instructions; alongside it, rows support the shopping-list-style add/edit/delete
// drawer flow (AddIngredientDrawer, IngredientEditDrawer, DraftIngredientRow) for one-at-a-time
// entry — the two paths write into the same `ingredients` array.
// fallow-ignore-next-line complexity
export const IngredientsField = ({
    ingredients,
    ingredientsPasteText,
    setIngredientsPasteText,
    showIngredientsPaste,
    setShowIngredientsPaste,
    onChange,
    disabled,
    isImporting,
}: IngredientsFieldProps) => {
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const editDrawer = useItemEditDrawer();

    const handleEditStart = (index: number) => {
        const target = ingredients[index];
        setEditingIndex(index);
        editDrawer.openDrawer({ name: target.name, quantity: target.quantity, unit: target.unit });
    };

    const handleEditCancel = () => {
        editDrawer.closeDrawer();
        setEditingIndex(null);
    };

    const handleEditSave = () => {
        if (editingIndex === null) return;

        const { values } = editDrawer;
        const updated = [...ingredients];
        updated[editingIndex] = {
            name: values.name.trim(),
            quantity: values.quantity.trim() ? parseFloat(values.quantity) : undefined,
            unit: values.unit.trim() || undefined,
        };
        onChange(updated);
        handleEditCancel();
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setShowIngredientsPaste(!showIngredientsPaste)}
                    className="text-xs text-muted-foreground underline"
                >
                    {showIngredientsPaste ? 'add one at a time ↓' : 'edit text ↩'}
                </button>
            </div>
            {showIngredientsPaste ? (
                <Textarea
                    placeholder="Paste ingredients here — each line becomes an item automatically..."
                    value={ingredientsPasteText}
                    onChange={(e) => setIngredientsPasteText(e.target.value)}
                    onBlur={() => {
                        const parsed = splitIntoSteps(ingredientsPasteText);
                        if (parsed.length > 0) {
                            onChange(parsed.map((name) => ({ name })));
                            setShowIngredientsPaste(false);
                        }
                    }}
                    disabled={disabled || isImporting}
                    name="recipe-ingredients"
                    autoComplete="off"
                    inputMode="text"
                    className="min-h-[80px] resize-none border border-foreground/30"
                />
            ) : (
                <div className="space-y-2">
                    {ingredients.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-1">No ingredients added yet</p>
                    ) : (
                        <div className="space-y-1">
                            {ingredients.map((ingredient, i) => (
                                <DraftIngredientRow
                                    key={`${i}-${ingredient.name.slice(0, 20)}`}
                                    ingredient={ingredient}
                                    onEdit={() => handleEditStart(i)}
                                    onDelete={() => onChange(ingredients.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>
                    )}

                    <AddIngredientDrawer
                        open={isAddDrawerOpen}
                        onOpenChange={setIsAddDrawerOpen}
                        onAdd={async (name, quantity, unit) => onChange([...ingredients, { name, quantity, unit }])}
                        trigger={
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                disabled={disabled || isImporting}
                            >
                                <Plus className="h-4 w-4" />
                                Add ingredient
                            </Button>
                        }
                    />
                </div>
            )}

            <IngredientEditDrawer
                open={editDrawer.isOpen}
                name={editDrawer.values.name}
                quantity={editDrawer.values.quantity}
                unit={editDrawer.values.unit}
                onNameChange={editDrawer.updateName}
                onQuantityChange={editDrawer.updateQuantity}
                onUnitChange={editDrawer.updateUnit}
                onSave={handleEditSave}
                onCancel={handleEditCancel}
            />
        </div>
    );
};
