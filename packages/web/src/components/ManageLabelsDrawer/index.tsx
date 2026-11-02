import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useLabels } from '../../hooks/useLabels';
import { Button } from '../ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { Input } from '../ui/input';

export interface ManageLabelsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DEFAULT_COLOR = '#3b82f6';

export const ManageLabelsDrawer = ({ open, onOpenChange }: ManageLabelsDrawerProps) => {
    const { labels, createLabel, deleteLabel } = useLabels();
    const [name, setName] = useState('');
    const [color, setColor] = useState(DEFAULT_COLOR);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed || isCreating) return;
        setIsCreating(true);
        try {
            await createLabel({ name: trimmed, color });
            setName('');
            setColor(DEFAULT_COLOR);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm flex flex-col h-[500px] max-h-[500px]">
                    <DrawerHeader className="flex-shrink-0">
                        <DrawerTitle>Manage Labels</DrawerTitle>
                        <DrawerDescription>Create and remove calendar labels</DrawerDescription>
                    </DrawerHeader>
                    <div className="flex-1 overflow-y-auto px-4 space-y-2">
                        {labels.length === 0 && (
                            <p className="py-8 text-center text-sm text-muted-foreground">No labels yet</p>
                        )}
                        {labels.map((label) => (
                            <div key={label.id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: label.color }} />
                                <span className="flex-1">{label.name}</span>
                                <Button variant="ghost" size="icon" onClick={() => void deleteLabel(label.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <DrawerFooter>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                aria-label="Label colour"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="h-10 w-12 rounded border"
                            />
                            <Input
                                purpose="name"
                                value={name}
                                placeholder="Label name"
                                className="h-10"
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleCreate();
                                }}
                            />
                            <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
                                {isCreating ? 'Adding…' : 'Add'}
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
