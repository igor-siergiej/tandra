import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addUserToRecipe, removeUserFromRecipe } from '../api';
import { notifyError, notifySuccess } from '../utils/toast';

interface ManageRecipeUsersHookProps {
    recipeId: string;
    userId: string;
}

export const useManageRecipeUsers = ({ recipeId, userId }: ManageRecipeUsersHookProps) => {
    const queryClient = useQueryClient();

    const invalidateRecipesList = () => {
        if (userId) void queryClient.invalidateQueries({ queryKey: ['recipes', userId] });
    };

    const addUserMutation = useMutation({
        mutationFn: (friendId: string) => addUserToRecipe(recipeId, friendId),
        onSuccess: () => {
            invalidateRecipesList();
            notifySuccess('User added successfully');
        },
        onError: (error: Error) => {
            notifyError(error.message || 'Failed to add user');
        },
    });

    const removeUserMutation = useMutation({
        mutationFn: (userId: string) => removeUserFromRecipe(recipeId, userId),
        onSuccess: () => {
            invalidateRecipesList();
            notifySuccess('User removed successfully');
        },
        onError: (error: Error) => {
            notifyError(error.message || 'Failed to remove user');
        },
    });

    return {
        addUserMutation,
        removeUserMutation,
    };
};
