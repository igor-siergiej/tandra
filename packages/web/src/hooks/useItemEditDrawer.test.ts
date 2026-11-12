import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { useItemEditDrawer } from './useItemEditDrawer';

describe('useItemEditDrawer', () => {
    it('initializes with closed drawer and empty values', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        expect(result.current.isOpen).toBe(false);
        expect(result.current.values.name).toBe('');
        expect(result.current.values.quantity).toBe('');
        expect(result.current.values.unit).toBe('');
    });

    it('opens drawer and sets initial values from item', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        act(() => {
            result.current.openDrawer({
                name: 'Test Item',
                quantity: 5,
                unit: 'kg',
            });
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.values.name).toBe('Test Item');
        expect(result.current.values.quantity).toBe('5');
        expect(result.current.values.unit).toBe('kg');
    });

    it('updates individual values', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        act(() => {
            result.current.updateName('New Name');
        });
        expect(result.current.values.name).toBe('New Name');

        act(() => {
            result.current.updateQuantity('10');
        });
        expect(result.current.values.quantity).toBe('10');

        act(() => {
            result.current.updateUnit('l');
        });
        expect(result.current.values.unit).toBe('l');
    });

    it('closes drawer and resets values', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        act(() => {
            result.current.openDrawer({
                name: 'Test Item',
                quantity: 5,
                unit: 'kg',
            });
        });

        expect(result.current.isOpen).toBe(true);

        act(() => {
            result.current.closeDrawer();
        });

        expect(result.current.isOpen).toBe(false);
        expect(result.current.values.name).toBe('');
        expect(result.current.values.quantity).toBe('');
        expect(result.current.values.unit).toBe('');
    });

    it('detects name changes', () => {
        const { result } = renderHook(() => useItemEditDrawer());
        const originalName = 'Original';

        act(() => {
            result.current.openDrawer({
                name: originalName,
                quantity: undefined,
                unit: undefined,
            });
            result.current.updateName('Updated');
        });

        expect(result.current.hasChanges()).toBe(true);

        act(() => {
            result.current.updateName(originalName);
        });

        expect(result.current.hasChanges()).toBe(false);
    });

    it('detects quantity/unit changes', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        act(() => {
            result.current.openDrawer({
                name: 'Item',
                quantity: 5,
                unit: 'kg',
            });
            result.current.updateQuantity('10');
        });

        expect(result.current.hasChanges()).toBe(true);
    });

    it('tracks the aisle and counts a change of it as an edit', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        act(() => {
            result.current.openDrawer({ name: 'Milk', quantity: undefined, unit: undefined, category: 'dairy' });
        });
        expect(result.current.values.category).toBe('dairy');
        expect(result.current.hasChanges()).toBe(false);

        act(() => result.current.updateCategory('household'));
        expect(result.current.hasChanges()).toBe(true);
    });

    it('starts with no aisle chosen for an unclassified item', () => {
        const { result } = renderHook(() => useItemEditDrawer());

        act(() => {
            result.current.openDrawer({ name: 'Milk', quantity: undefined, unit: undefined });
        });

        expect(result.current.values.category).toBe('');
    });
});
