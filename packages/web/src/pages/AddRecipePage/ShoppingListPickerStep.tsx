import type { ListResponse } from '@tandra/types';

import { ShoppingListItemPicker } from './ShoppingListItemPicker';
import { ShoppingListPicker } from './ShoppingListPicker';

export interface ShoppingListPickerStepProps {
    shoppingLists: ListResponse[];
    chosenList: ListResponse | null;
    selectedIds: Set<string>;
    onChooseList: (title: string | null) => void;
    onToggleItem: (id: string) => void;
}

export const ShoppingListPickerStep = ({
    shoppingLists,
    chosenList,
    selectedIds,
    onChooseList,
    onToggleItem,
}: ShoppingListPickerStepProps) => {
    if (!chosenList) {
        return <ShoppingListPicker lists={shoppingLists} onSelect={onChooseList} />;
    }

    return (
        <ShoppingListItemPicker
            list={chosenList}
            selectedIds={selectedIds}
            onBack={() => onChooseList(null)}
            onToggleItem={onToggleItem}
        />
    );
};
