import type { User } from '@tandra/types';
import { useEffect, useState } from 'react';

import { useFriends } from '../../../hooks/useFriends';
import { FriendPicker } from '../../FriendPicker';
import { Button } from '../../ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '../../ui/drawer';
import { Label } from '../../ui/label';

export interface ManageTodoSharingDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    users: User[];
    onSave: (users: User[]) => void;
}

export const ManageTodoSharingDrawer = ({ open, onOpenChange, title, users, onSave }: ManageTodoSharingDrawerProps) => {
    const { friends } = useFriends();
    const [memberIds, setMemberIds] = useState<string[]>(() => users.map((u) => u.id));

    useEffect(() => {
        setMemberIds(users.map((u) => u.id));
    }, [users]);

    const handleChange = (nextIds: string[]) => {
        setMemberIds(nextIds);
        onSave(friends.filter((f) => nextIds.includes(f.id)));
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm flex flex-col h-[500px] max-h-[500px]">
                    <DrawerHeader className="flex-shrink-0">
                        <DrawerTitle>Manage Sharing</DrawerTitle>
                        <DrawerDescription>{title}</DrawerDescription>
                    </DrawerHeader>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Shared with</Label>
                            <FriendPicker value={memberIds} onChange={handleChange} />
                        </div>
                    </div>

                    <DrawerFooter className="flex-shrink-0">
                        <DrawerClose asChild>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Close
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
