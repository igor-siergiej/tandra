import type { Recipe } from '@tandra/types';
import { useState } from 'react';

import { PinnedSearchField } from '../../components/PinnedSearchField';
import { Button } from '../../components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../../components/ui/drawer';
import { useRecipeSearch } from '../../hooks/useRecipeSearch';

interface RecipePickerDrawerProps {
    open: boolean;
    dayLabel: string;
    recipes: Array<Recipe>;
    onPick: (recipe: Recipe) => void;
    onOpenChange: (open: boolean) => void;
}

export const RecipePickerDrawer = ({ open, dayLabel, recipes, onPick, onOpenChange }: RecipePickerDrawerProps) => {
    const [search, setSearch] = useState('');
    const matches = useRecipeSearch(recipes, search);

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Plan a recipe for {dayLabel}</DrawerTitle>
                    </DrawerHeader>
                    <ul className="max-h-[50vh] space-y-2 overflow-y-auto p-4" aria-label="Recipes">
                        {matches.map((recipe) => (
                            <li key={recipe.id}>
                                <button
                                    type="button"
                                    className="w-full rounded-lg border p-3 text-left hover:bg-accent"
                                    onClick={() => {
                                        onPick(recipe);
                                        setSearch('');
                                    }}
                                >
                                    {recipe.title}
                                </button>
                            </li>
                        ))}
                        {matches.length === 0 && <li className="text-sm text-muted-foreground">No recipes found.</li>}
                    </ul>
                    <div className="px-4">
                        <PinnedSearchField
                            value={search}
                            onChange={setSearch}
                            placeholder="Search recipes"
                            name="meal-plan-recipe-search"
                        />
                    </div>
                    <DrawerFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
