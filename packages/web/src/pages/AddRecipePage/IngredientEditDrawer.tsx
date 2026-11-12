import { useId } from 'react';

import { QuantityUnitField } from '../../components/QuantityUnitField';
import { Button } from '../../components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '../../components/ui/drawer';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export interface IngredientEditDrawerProps {
    open: boolean;
    name: string;
    quantity: string;
    unit: string;
    onNameChange: (value: string) => void;
    onQuantityChange: (value: string) => void;
    onUnitChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
}

// Mirrors ItemCheckBox's edit drawer, decoupled from useItemMutations: this operates on
// draft (not-yet-persisted) recipe ingredients, so save/cancel are plain local-state callbacks.
export const IngredientEditDrawer = ({
    open,
    name,
    quantity,
    unit,
    onNameChange,
    onQuantityChange,
    onUnitChange,
    onSave,
    onCancel,
}: IngredientEditDrawerProps) => {
    const nameId = useId();
    const quantityId = useId();
    const unitId = useId();

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onCancel()}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Edit Ingredient</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-4">
                        <div>
                            <Label htmlFor={nameId}>Ingredient Name</Label>
                            <Input
                                id={nameId}
                                value={name}
                                purpose="name"
                                autoFocus
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="Enter ingredient name"
                                className="mt-2"
                            />
                        </div>
                        <QuantityUnitField
                            quantity={quantity}
                            unit={unit}
                            onQuantityChange={onQuantityChange}
                            onUnitChange={onUnitChange}
                            quantityId={quantityId}
                            unitId={unitId}
                        />
                    </div>
                    <DrawerFooter>
                        <Button onClick={onSave} disabled={!name.trim()}>
                            Save Changes
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
