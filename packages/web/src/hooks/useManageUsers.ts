import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { addUserToList, removeUserFromList } from '../api';

interface ManageUsersHookProps {
    listTitle: string;
}

export const useManageUsers = ({ listTitle }: ManageUsersHookProps) => {
    const addUserMutation = useMutation({
        mutationFn: (friendId: string) => addUserToList(listTitle, friendId),
        onSuccess: () => {
            toast.success('User added successfully', {
                style: {
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                },
            });
        },
        onError: (error: unknown) => {
            const err = error as { message?: string };
            toast.error(err.message || 'Failed to add user', {
                style: {
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                },
            });
        },
    });

    const removeUserMutation = useMutation({
        mutationFn: (userId: string) => removeUserFromList(listTitle, userId),
        onSuccess: () => {
            toast.success('User removed successfully', {
                style: {
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                },
            });
        },
        onError: (error: unknown) => {
            const err = error as { message?: string };
            toast.error(err.message || 'Failed to remove user', {
                style: {
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                },
            });
        },
    });

    return {
        addUserMutation,
        removeUserMutation,
    };
};
