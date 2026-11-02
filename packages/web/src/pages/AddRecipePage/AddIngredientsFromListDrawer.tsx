import type { ListResponse } from '@tandra/types';
import { ListPlus } from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '../../components/ui/drawer';
import type { Ingredient } from './IngredientsField';
import { ShoppingListPickerStep } from './ShoppingListPickerStep';
import { useAddIngredientsFromList } from './useAddIngredientsFromList';

export interface AddIngredientsFromListDrawerProps {
    lists: ListResponse[];
    disabled?: boolean;
    onAdd: (ingredients: Ingredient[]) => void;
}

// Mirrors RecipeDetailPage/IngredientSelectSection's list-chip picker, in reverse: pick a
// shopping list then pick which of its items become ingredient rows on this recipe.
// State lives in useAddIngredientsFromList; step rendering lives in ShoppingListPickerStep.
export const AddIngredientsFromListDrawer = ({ lists, disabled, onAdd }: AddIngredientsFromListDrawerProps) => {
    const {
        open,
        setOpenState,
        shoppingLists,
        chosenList,
        headerTitle,
        confirmLabel,
        confirmDisabled,
        chooseList,
        selectedIds,
        toggleItem,
        confirm,
    } = useAddIngredientsFromList(lists, onAdd);

    return (
        <Drawer open={open} onOpenChange={setOpenState}>
            <DrawerTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full gap-2" disabled={disabled}>
                    <ListPlus className="h-4 w-4" />
                    Add from shopping list
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader>
                        <DrawerTitle>{headerTitle}</DrawerTitle>
                    </DrawerHeader>

                    <div className="p-4 pb-0 space-y-4 max-h-[60vh] overflow-y-auto">
                        <ShoppingListPickerStep
                            shoppingLists={shoppingLists}
                            chosenList={chosenList}
                            selectedIds={selectedIds}
                            onChooseList={chooseList}
                            onToggleItem={toggleItem}
                        />
                    </div>

                    <DrawerFooter>
                        <Button type="button" onClick={confirm} disabled={confirmDisabled}>
                            {confirmLabel}
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
