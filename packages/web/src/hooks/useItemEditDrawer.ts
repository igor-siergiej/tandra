import { useState } from 'react';

interface EditValues {
    name: string;
    quantity: string;
    unit: string;
    /** An ItemCategory, or '' while the item is still unclassified and the user hasn't picked one. */
    category: string;
}

interface EditItemData {
    name: string;
    quantity: number | undefined;
    unit: string | undefined;
    category?: string;
}

export const useItemEditDrawer = () => {
    const [isOpen, setIsOpen] = useState(false);

    const [values, setValues] = useState<EditValues>({
        name: '',
        quantity: '',
        unit: '',
        category: '',
    });

    const [originalValues, setOriginalValues] = useState<EditValues>({
        name: '',
        quantity: '',
        unit: '',
        category: '',
    });

    const openDrawer = (item: EditItemData) => {
        const newValues: EditValues = {
            name: item.name,
            quantity: item.quantity?.toString() ?? '',
            unit: item.unit ?? '',
            category: item.category ?? '',
        };

        setValues(newValues);
        setOriginalValues(newValues);
        setIsOpen(true);
    };

    const closeDrawer = () => {
        setIsOpen(false);
        setValues({
            name: '',
            quantity: '',
            unit: '',
            category: '',
        });
        setOriginalValues({
            name: '',
            quantity: '',
            unit: '',
            category: '',
        });
    };

    const updateName = (name: string) => {
        setValues((prev) => ({ ...prev, name }));
    };

    const updateQuantity = (quantity: string) => {
        setValues((prev) => ({ ...prev, quantity }));
    };

    const updateUnit = (unit: string) => {
        setValues((prev) => ({ ...prev, unit }));
    };

    const updateCategory = (category: string) => {
        setValues((prev) => ({ ...prev, category }));
    };

    const hasChanges = () => {
        return (
            values.name !== originalValues.name ||
            values.quantity !== originalValues.quantity ||
            values.unit !== originalValues.unit ||
            values.category !== originalValues.category
        );
    };

    return {
        isOpen,
        values,
        openDrawer,
        closeDrawer,
        updateName,
        updateQuantity,
        updateUnit,
        updateCategory,
        hasChanges,
    };
};
