import type { User } from '@tandra/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { generateFriendCode, getFriendsQuery, redeemFriendCode, unfriend } from '../api';

export const useFriends = () => {
    const { data, isLoading } = useQuery<User[]>(getFriendsQuery());
    return { friends: data ?? [], isLoading };
};

export const useGenerateFriendCode = () => useMutation({ mutationFn: generateFriendCode });

export const useRedeemFriendCode = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: redeemFriendCode,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['friends'] });
        },
    });
};

export const useUnfriend = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: unfriend,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['friends'] });
            // Hard-revoke strips the ex-friend from lists, recipes and todos server-side.
            void queryClient.invalidateQueries({ queryKey: ['lists'] });
            void queryClient.invalidateQueries({ queryKey: ['recipes'] });
            void queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });
};
