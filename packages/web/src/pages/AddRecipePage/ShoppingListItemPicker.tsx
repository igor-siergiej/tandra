import type { ListResponse } from '@tandra/types';

import { IngredientSelectRow } from '../../components/IngredientSelectRow';

export interface ShoppingListItemPickerProps {
    list: ListResponse;
    selectedIds: Set<string>;
    onBack: () => void;
    onToggleItem: (id: string) => void;
}

export const ShoppingListItemPicker = ({ list, selectedIds, onBack, onToggleItem }: ShoppingListItemPickerProps) => (
    <div className="space-y-3">
        <button type="button" onClick={onBack} className="text-xs text-muted-foreground underline">
            ← choose a different list
        </button>
        <div className="grid gap-2">
            {list.items.length === 0 ? (
                <p className="text-muted-foreground text-sm py-3">This list has no items</p>
            ) : (
                list.items.map((item) => (
                    <IngredientSelectRow
                        key={item.id}
                        ingredient={item}
                        isSelected={selectedIds.has(item.id)}
                        onToggle={onToggleItem}
                    />
                ))
            )}
        </div>
    </div>
);
