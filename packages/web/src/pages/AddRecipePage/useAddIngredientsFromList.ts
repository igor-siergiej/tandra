import type { ListResponse } from '@tandra/types';
import { ListType } from '@tandra/types';
import { useState } from 'react';

import type { Ingredient } from './IngredientsField';

const toIngredient = (item: ListResponse['items'][number]): Ingredient => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
});

const shoppingListsOf = (lists: ListResponse[]): ListResponse[] =>
    lists.filter((list) => list.listType === ListType.SHOPPING);

const findList = (lists: ListResponse[], title: string | null): ListResponse | null =>
    lists.find((list) => list.title === title) ?? null;

const toggleInSet = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);

    return next;
};

const headerTitleOf = (list: ListResponse | null): string => list?.title ?? 'Choose a list';

const confirmLabelOf = (count: number): string => `Add ${count} ingredient${count === 1 ? '' : 's'}`;

const isConfirmDisabled = (list: ListResponse | null, selectedCount: number): boolean => !list || selectedCount === 0;

const confirmedIngredients = (list: ListResponse | null, selectedIds: Set<string>): Ingredient[] =>
    (list?.items ?? []).filter((item) => selectedIds.has(item.id)).map(toIngredient);

export const useAddIngredientsFromList = (lists: ListResponse[], onAdd: (ingredients: Ingredient[]) => void) => {
    const [open, setOpen] = useState(false);
    const [chosenListTitle, setChosenListTitle] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const shoppingLists = shoppingListsOf(lists);
    const chosenList = findList(shoppingLists, chosenListTitle);

    const setOpenState = (next: boolean) => {
        setOpen(next);

        if (!next) {
            setChosenListTitle(null);
            setSelectedIds(new Set());
        }
    };

    const toggleItem = (id: string) => setSelectedIds((prev) => toggleInSet(prev, id));

    const confirm = () => {
        onAdd(confirmedIngredients(chosenList, selectedIds));
        setOpenState(false);
    };

    return {
        open,
        setOpenState,
        shoppingLists,
        chosenList,
        headerTitle: headerTitleOf(chosenList),
        confirmLabel: confirmLabelOf(selectedIds.size),
        confirmDisabled: isConfirmDisabled(chosenList, selectedIds.size),
        chooseList: setChosenListTitle,
        selectedIds,
        toggleItem,
        confirm,
    };
};
