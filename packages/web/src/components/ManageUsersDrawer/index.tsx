'use client';

import { useEffect, useState } from 'react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '../../components/ui/drawer';
import { Label } from '../../components/ui/label';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useFriends } from '../../hooks/useFriends';
import { FriendPicker } from '../FriendPicker';

interface MutationLike<TVariables> {
    mutate: (variables: TVariables, options?: { onSuccess?: () => void }) => void;
}

interface ManageUsersDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    currentUsers: Array<{ id: string; username: string }>;
    ownerId: string;
    currentUserId: string;
    addUserMutation: MutationLike<string>;
    removeUserMutation: MutationLike<string>;
    onUserAdded: () => void;
    onUserRemoved: () => void;
}

const getMemberIds = (currentUsers: Array<{ id: string; username: string }>, ownerId: string) =>
    currentUsers.flatMap((u) => (u.id === ownerId ? [] : [u.id]));

export const ManageUsersDrawer = ({
    open,
    onOpenChange,
    title,
    currentUsers,
    ownerId,
    addUserMutation,
    removeUserMutation,
    onUserAdded,
    onUserRemoved,
}: ManageUsersDrawerProps) => {
    const { friends } = useFriends();
    const { confirm, isOpen, config: confirmConfig, handleConfirm, handleCancel } = useConfirmation();

    // Local state is the source of truth for the picker so a cancelled removal
    // leaves the toggle ON instead of flickering off while awaiting confirm.
    const [memberIds, setMemberIds] = useState<string[]>(() => getMemberIds(currentUsers, ownerId));

    useEffect(() => {
        setMemberIds(getMemberIds(currentUsers, ownerId));
    }, [currentUsers, ownerId]);

    const ownerUsername = currentUsers.find((u) => u.id === ownerId)?.username;

    const handleChange = (nextIds: string[]) => {
        const added = nextIds.filter((id) => !memberIds.includes(id));
        const removed = memberIds.filter((id) => !nextIds.includes(id));

        for (const friendId of added) {
            setMemberIds((prev) => [...prev, friendId]);
            addUserMutation.mutate(friendId, { onSuccess: onUserAdded });
        }

        for (const userId of removed) {
            const username =
                currentUsers.find((u) => u.id === userId)?.username ??
                friends.find((f) => f.id === userId)?.username ??
                'this member';

            confirm({
                title: 'Remove member?',
                description: `Remove ${username} from this list?`,
                actionLabel: 'Remove',
                onConfirm: () => {
                    removeUserMutation.mutate(userId, {
                        onSuccess: () => {
                            setMemberIds((prev) => prev.filter((id) => id !== userId));
                            onUserRemoved();
                        },
                    });
                },
            });
        }
    };

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-sm flex flex-col h-[500px] max-h-[500px]">
                        <DrawerHeader className="flex-shrink-0">
                            <DrawerTitle>Manage Users</DrawerTitle>
                            <DrawerDescription>{title}</DrawerDescription>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-4">
                                {ownerUsername && (
                                    <p className="text-sm text-muted-foreground">Owner: {ownerUsername}</p>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Members</Label>
                                    <FriendPicker value={memberIds} onChange={handleChange} />
                                </div>
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

            <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmConfig?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{confirmConfig?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>
                            {confirmConfig?.cancelLabel || 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            {confirmConfig?.actionLabel || 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
