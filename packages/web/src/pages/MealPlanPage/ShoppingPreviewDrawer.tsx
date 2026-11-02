import type { ListResponse } from '@tandra/types';
import { useEffect, useId, useState } from 'react';

import { Button } from '../../components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../../components/ui/drawer';
import { Label } from '../../components/ui/label';
import type { ShoppingRow } from '../../utils/mealPlan';

interface ShoppingPreviewDrawerProps {
    open: boolean;
    rangeLabel: string;
    rows: Array<ShoppingRow>;
    lists: Array<ListResponse>;
    onConfirm: (listTitle: string, rows: Array<ShoppingRow>) => Promise<void>;
    onOpenChange: (open: boolean) => void;
}

const describe = (row: ShoppingRow) => [row.quantity, row.unit].filter((part) => part !== undefined).join(' ');

// fallow-ignore-next-line complexity
export const ShoppingPreviewDrawer = ({
    open,
    rangeLabel,
    rows,
    lists,
    onConfirm,
    onOpenChange,
}: ShoppingPreviewDrawerProps) => {
    const listSelectId = useId();
    const [listTitle, setListTitle] = useState('');
    const [dropped, setDropped] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setDropped(new Set());
        setError(null);
        setListTitle((current) => current || lists[0]?.id || '');
    }, [open, lists]);

    const kept = rows.filter((row) => !dropped.has(row.key));

    const toggle = (key: string) =>
        setDropped((current) => {
            const next = new Set(current);

            if (!next.delete(key)) next.add(key);

            return next;
        });

    const confirm = async () => {
        setBusy(true);
        setError(null);

        try {
            await onConfirm(listTitle, kept);
            onOpenChange(false);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Failed to add items');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Shop for {rangeLabel}</DrawerTitle>
                    </DrawerHeader>
                    <div className="space-y-3 p-4 pb-0">
                        <div>
                            <Label htmlFor={listSelectId}>Add to list</Label>
                            <select
                                id={listSelectId}
                                className="mt-2 h-12 w-full rounded-md border bg-background px-3 text-base"
                                value={listTitle}
                                onChange={(event) => setListTitle(event.target.value)}
                            >
                                {lists.map((list) => (
                                    <option key={list.id} value={list.id}>
                                        {list.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <ul className="max-h-[40vh] space-y-1 overflow-y-auto" aria-label="Ingredients to add">
                            {rows.map((row) => (
                                <li key={row.key}>
                                    <label className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">
                                        <input
                                            type="checkbox"
                                            checked={!dropped.has(row.key)}
                                            onChange={() => toggle(row.key)}
                                        />
                                        <span className="flex-1">
                                            {row.name}
                                            <span className="block text-xs text-muted-foreground">
                                                {row.recipeTitle}
                                            </span>
                                        </span>
                                        <span className="text-sm text-muted-foreground">{describe(row)}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                        {error && (
                            <p className="text-sm text-destructive" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                    <DrawerFooter>
                        <Button onClick={confirm} disabled={busy || !listTitle || kept.length === 0}>
                            {kept.length === 1 ? 'Add 1 ingredient' : `Add ${kept.length} ingredients`}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
