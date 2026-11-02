import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { QuantityUnitField } from '../../../components/QuantityUnitField';
import { notifyError } from '../../../utils/toast';
import { Button } from '../../ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '../../ui/drawer';
import { Input } from '../../ui/input';
import { RippleButton } from '../../ui/ripple';

export interface AddIngredientDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (name: string, quantity?: number, unit?: string) => Promise<void>;
    /** Custom trigger element; defaults to the round FAB-style button used in the ToolBar. */
    trigger?: ReactNode;
}

const defaultTrigger = (
    <RippleButton
        size="icon"
        className="h-12 w-12 rounded-full border-2 border-primary/20 hover:border-primary/40 transition-colors"
        aria-label="Add ingredient"
    >
        <Plus className="size-5" />
    </RippleButton>
);

export const AddIngredientDrawer = ({ open, onOpenChange, onAdd, trigger }: AddIngredientDrawerProps) => {
    const ingredientNameId = useId();
    const quantityId = useId();
    const unitId = useId();
    const [newName, setNewName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        const trimmedName = newName.trim();

        if (!trimmedName) {
            setError('Ingredient name is required');

            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const quantityNum = quantity.trim() ? parseFloat(quantity) : undefined;
            const unitValue = unit.trim() || undefined;
            await onAdd(trimmedName, quantityNum, unitValue);

            setNewName('');
            setQuantity('');
            setUnit('');
            onOpenChange(false);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to add ingredient';
            setError(errorMsg);
            notifyError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setNewName('');
        setQuantity('');
        setUnit('');
        setError('');
        onOpenChange(false);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>{trigger ?? defaultTrigger}</DrawerTrigger>
            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader>
                        <DrawerTitle>Add Ingredient</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-0 space-y-4">
                        <div className="space-y-2">
                            <Input
                                id={ingredientNameId}
                                type="search"
                                value={newName}
                                purpose="name"
                                autoFocus
                                className={`${error ? 'border-destructive' : ''} h-12 text-base`}
                                onChange={(event) => {
                                    setError('');
                                    setNewName(event.target.value);
                                }}
                                placeholder="Enter ingredient name..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        void handleSubmit();
                                    } else if (e.key === 'Escape') {
                                        handleCancel();
                                    }
                                }}
                            />
                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </div>

                        <QuantityUnitField
                            quantity={quantity}
                            unit={unit}
                            onQuantityChange={setQuantity}
                            onUnitChange={setUnit}
                            quantityId={quantityId}
                            unitId={unitId}
                        />
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            Add Ingredient
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                                Cancel
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
