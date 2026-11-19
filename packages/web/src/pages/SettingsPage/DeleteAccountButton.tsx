import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { deleteAccount } from '../../api';
import { useAuth } from '../../auth';
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
import { Input } from '../../components/ui/input';
import { clearUserData } from '../../offline/clearUserData';

interface DeleteAccountButtonProps {
    username: string;
}

/**
 * "Delete my account": opens a confirmation that only enables once the person has typed their own username. The
 * typed value goes in the request too, and the server checks it again. On success the device is signed out and
 * wiped like an ordinary logout, then sent to the sign-in page.
 */
export const DeleteAccountButton = ({ username }: DeleteAccountButtonProps) => {
    const { logout } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');

    const remove = useMutation({
        mutationFn: () => deleteAccount(typed),
        onSuccess: async () => {
            await logout();
            await clearUserData(queryClient);
            navigate('/login');
        },
    });

    const handleOpenChange = (next: boolean) => {
        // Not while the request runs: closing then would hide a failure and invite a second request.
        if (remove.isPending) return;
        setOpen(next);

        if (!next) {
            setTyped('');
            remove.reset();
        }
    };

    return (
        <>
            <Button type="button" variant="outline" className="w-full text-destructive" onClick={() => setOpen(true)}>
                Delete my account
            </Button>
            <AlertDialog open={open} onOpenChange={handleOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes your lists, recipes, todos, meal plans, photos and friends, and
                            takes down anything you published to Discover. Lists you shared stay with the people you
                            shared them with, minus you. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <label htmlFor="delete-account-username" className="text-sm text-foreground">
                            Type your username <span className="font-semibold">{username}</span> to confirm
                        </label>
                        <Input
                            id="delete-account-username"
                            value={typed}
                            onChange={(event) => setTyped(event.target.value)}
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            disabled={remove.isPending}
                        />
                    </div>
                    {remove.isError && (
                        <p role="alert" className="text-xs text-destructive">
                            Could not delete your account. Please try again.
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={typed !== username || remove.isPending}
                            onClick={(event) => {
                                // Keep the dialog open until the request settles, so a failure can be shown and retried.
                                event.preventDefault();
                                remove.mutate();
                            }}
                        >
                            {remove.isPending ? 'Deleting...' : 'Delete account'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
