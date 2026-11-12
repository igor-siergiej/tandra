import type { ListType } from '@tandra/types';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';

import { QuantityUnitField } from '../../../components/QuantityUnitField';
import { Button } from '../../../components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '../../../components/ui/drawer';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RippleButton } from '../../../components/ui/ripple';

export interface AddItemDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (name: string, quantity?: number, unit?: string) => Promise<void>;
    listType?: ListType;
    placeholder?: string;
}

export const AddItemDrawer = ({ open, onOpenChange, onAdd, placeholder }: AddItemDrawerProps) => {
    const itemNameId = useId();
    const [newName, setNewName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        const trimmedName = newName.trim();

        if (!trimmedName) {
            setError('Item name is required');

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
            setError(err instanceof Error ? err.message : 'Failed to add item');
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

    const title = 'Add New Item';

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>
                <RippleButton
                    size="icon"
                    className="h-12 w-12 rounded-full border-2 border-primary/20 hover:border-primary/40 transition-colors"
                >
                    <Plus className="size-5" />
                </RippleButton>
            </DrawerTrigger>
            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader>
                        <DrawerTitle>{title}</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-0 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-item">Item Name</Label>
                            <Input
                                id={itemNameId}
                                type="search"
                                value={newName}
                                autoFocus
                                className={`${error ? 'border-destructive' : ''} h-12 text-base`}
                                onChange={(event) => {
                                    setError('');
                                    setNewName(event.target.value);
                                }}
                                placeholder={placeholder}
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
                            quantityId="new-item-quantity"
                            unitId="new-item-unit"
                        />
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            Add Item
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline" onClick={handleCancel}>
                                Cancel
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
