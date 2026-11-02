import type { User } from '@tandra/types';
import { ArrowLeft } from 'lucide-react';

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
import { useConfirmation } from '../../hooks/useConfirmation';
import { useUnfriend } from '../../hooks/useFriends';

interface FriendDetailProps {
    friend: User;
    onBack: () => void;
}

export const FriendDetail = ({ friend, onBack }: FriendDetailProps) => {
    const { confirm, isOpen, config: confirmConfig, handleConfirm, handleCancel } = useConfirmation();
    const { mutate: unfriend, isPending: isRemoving } = useUnfriend();

    const handleRemoveFriend = () => {
        confirm({
            title: 'Remove friend?',
            description: `Are you sure you want to remove ${friend.username} as a friend? This cannot be undone.`,
            actionLabel: 'Remove friend',
            onConfirm: () => {
                unfriend(friend.id, { onSuccess: onBack });
            },
        });
    };

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={onBack}
                className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Friends
            </button>

            <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground text-2xl font-semibold">
                    {friend.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-lg font-semibold">{friend.username}</span>
            </div>

            <Button variant="destructive" disabled={isRemoving} onClick={handleRemoveFriend}>
                Remove friend
            </Button>

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
        </div>
    );
};
