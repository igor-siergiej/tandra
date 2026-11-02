'use client';

import type { Item, Recipe } from '@tandra/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';

import { addItemsBulk, getRecipesQuery } from '../../../api';
import { useUser } from '../../../auth';
import { Button } from '../../../components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../../../components/ui/drawer';
import { RippleButton } from '../../../components/ui/ripple';
import { useIngredientSelection } from '../../../hooks/useIngredientSelection';
import { useRecipeSearch } from '../../../hooks/useRecipeSearch';
import { notifyError, notifySuccess } from '../../../utils/toast';
import { IngredientSelectRow } from '../../IngredientSelectRow';
import { PinnedSearchField } from '../../PinnedSearchField';
import { PortionsStepper } from '../../PortionsStepper';
import { RecipeResultCard } from '../../RecipeResultCard';

interface AddFromRecipeDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listTitle: string;
    listItems: Item[];
    hideTrigger?: boolean;
}

export const AddFromRecipeDrawer = ({
    open,
    onOpenChange,
    listTitle,
    listItems,
    hideTrigger = false,
}: AddFromRecipeDrawerProps) => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const [step, setStep] = useState<'recipes' | 'ingredients'>('recipes');
    const [chosenRecipe, setChosenRecipe] = useState<Recipe | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [recipeSearch, setRecipeSearch] = useState('');

    const { data: allRecipes = [] } = useQuery(
        user?.id ? getRecipesQuery(user.id) : { queryKey: [], queryFn: async () => [] }
    );
    const recipes = useRecipeSearch(allRecipes, recipeSearch);

    const existingItemNames = new Set(listItems.map((item) => item.name.toLowerCase()));
    const {
        selectedIds,
        toggleIngredient,
        portions,
        setPortions,
        scaledIngredients,
        selectedScaledIngredients,
        reset,
    } = useIngredientSelection(chosenRecipe?.ingredients ?? [], chosenRecipe?.servings ?? 1);

    const handleSelectRecipe = (recipe: Recipe) => {
        setChosenRecipe(recipe);
        reset(recipe.servings ?? 1);
        setStep('ingredients');
    };

    const handleConfirm = async () => {
        if (!chosenRecipe || selectedIds.size === 0) return;

        try {
            setIsLoading(true);
            const result = await addItemsBulk(
                listTitle,
                selectedScaledIngredients.map((ingredient) => ({
                    itemName: ingredient.name,
                    quantity: ingredient.quantity,
                    unit: ingredient.unit,
                }))
            );

            notifySuccess(`${result.added} items added, ${result.skipped} skipped`);

            await queryClient.invalidateQueries({ queryKey: [listTitle] });
            handleClose();
        } catch (error) {
            const err = error as { message?: string };
            notifyError(err.message || 'Failed to add ingredients');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setStep('recipes');
        setChosenRecipe(null);
        reset(1);
        setRecipeSearch('');
        onOpenChange(false);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            {!hideTrigger && (
                <RippleButton
                    size="icon"
                    variant="ghost"
                    aria-label="Add from recipe"
                    className="h-12 w-12 rounded-full"
                    onClick={() => onOpenChange(true)}
                >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                        <BookOpen className="size-5" />
                        <Plus className="size-3 absolute bottom-0 right-0 bg-white rounded-full text-primary" />
                    </div>
                </RippleButton>
            )}

            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader className="flex items-center gap-3">
                        {step === 'ingredients' && (
                            <button
                                onClick={() => setStep('recipes')}
                                className="p-1 hover:bg-muted rounded-md transition-colors"
                                type="button"
                                aria-label="Back to recipes"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        <DrawerTitle>
                            {step === 'recipes' ? 'Choose Recipe' : `Select from ${chosenRecipe?.title}`}
                        </DrawerTitle>
                    </DrawerHeader>

                    <div className="p-4 pb-0 max-h-[60vh] overflow-y-auto">
                        {step === 'recipes' ? (
                            <div className="flex min-h-full flex-col justify-between">
                                <div className="space-y-2">
                                    {recipes.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-3">No recipes found</p>
                                    ) : (
                                        recipes.map((recipe) => (
                                            <RecipeResultCard
                                                key={recipe.id}
                                                recipe={recipe}
                                                onClick={() => handleSelectRecipe(recipe)}
                                                subtitle={
                                                    <p className="text-sm text-muted-foreground">
                                                        {recipe.ingredients.length} ingredients
                                                    </p>
                                                }
                                            />
                                        ))
                                    )}
                                </div>
                                {/* Bottom-pinned so the on-screen keyboard can't cover it and the field
                                    stays within thumb reach of the results it filters. */}
                                <PinnedSearchField
                                    value={recipeSearch}
                                    onChange={setRecipeSearch}
                                    placeholder="Search recipes..."
                                    name="add-from-recipe-search"
                                />
                            </div>
                        ) : (
                            chosenRecipe && (
                                <div className="space-y-2">
                                    {chosenRecipe.ingredients.length > 0 && (
                                        <PortionsStepper value={portions} onChange={setPortions} min={1} />
                                    )}
                                    {scaledIngredients.length === 0 ? (
                                        <p className="text-muted-foreground text-sm py-3">No ingredients</p>
                                    ) : (
                                        scaledIngredients.map((ingredient) => {
                                            const isAlreadyInList = existingItemNames.has(
                                                ingredient.name.toLowerCase()
                                            );

                                            if (isAlreadyInList) {
                                                return (
                                                    <div
                                                        key={ingredient.id}
                                                        className="p-3 rounded-lg bg-muted/30 border border-muted-foreground/20 opacity-50"
                                                    >
                                                        <div className="font-medium line-through text-muted-foreground">
                                                            {ingredient.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Already in list
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <IngredientSelectRow
                                                    key={ingredient.id}
                                                    ingredient={ingredient}
                                                    isSelected={selectedIds.has(ingredient.id)}
                                                    onToggle={toggleIngredient}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            )
                        )}
                    </div>

                    {step === 'ingredients' && (
                        <DrawerFooter className="pt-4">
                            <Button onClick={handleClose} variant="outline" disabled={isLoading} type="button">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={selectedIds.size === 0 || isLoading}
                                type="button"
                            >
                                Add {selectedIds.size} items
                            </Button>
                        </DrawerFooter>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
};
