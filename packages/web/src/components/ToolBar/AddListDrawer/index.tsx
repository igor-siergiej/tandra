import type { ListType } from '@tandra/types';
import { ListType as ListTypeEnum } from '@tandra/types';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';

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
import { useGuest } from '../../../guest/GuestContext';
import { FriendPicker } from '../../FriendPicker';

export interface AddListDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (name: string, listType: ListType, users: string[]) => Promise<void>;
    placeholder?: string;
}

export const AddListDrawer = ({ open, onOpenChange, onAdd, placeholder }: AddListDrawerProps) => {
    const listNameId = useId();
    const [newName, setNewName] = useState('');
    const [shareWith, setShareWith] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Sharing needs an account (and friends), so guests only name the list.
    const { isGuest } = useGuest();

    const handleSubmit = async () => {
        const trimmedName = newName.trim();

        if (!trimmedName) {
            setError('List name is required');

            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await onAdd(trimmedName, ListTypeEnum.SHOPPING, shareWith);

            setNewName('');
            setShareWith([]);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create list');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setNewName('');
        setShareWith([]);
        setError('');
        onOpenChange(false);
    };

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
                        <DrawerTitle>Add New List</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-0 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={listNameId}>List Name</Label>
                            <Input
                                id={listNameId}
                                value={newName}
                                purpose="name"
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

                        {!isGuest && (
                            <div className="space-y-2">
                                <Label>Share with</Label>
                                <FriendPicker value={shareWith} onChange={setShareWith} seedAllByDefault />
                            </div>
                        )}
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            Add List
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
