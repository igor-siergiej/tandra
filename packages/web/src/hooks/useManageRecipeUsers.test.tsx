import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAddUserToRecipe, mockRemoveUserFromRecipe } = vi.hoisted(() => ({
    mockAddUserToRecipe: vi.fn(),
    mockRemoveUserFromRecipe: vi.fn(),
}));

vi.mock('../api', () => ({
    addUserToRecipe: mockAddUserToRecipe,
    removeUserFromRecipe: mockRemoveUserFromRecipe,
}));

import { useManageRecipeUsers } from './useManageRecipeUsers';

const wrap =
    (client: QueryClient) =>
    ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe('useManageRecipeUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('invalidates the recipes list cache after a user is added', async () => {
        mockAddUserToRecipe.mockResolvedValue({ id: 'R1', users: [] });
        const client = new QueryClient();
        const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

        const { result } = renderHook(() => useManageRecipeUsers({ recipeId: 'R1', userId: 'user-1' }), {
            wrapper: wrap(client),
        });

        result.current.addUserMutation.mutate('friend-1');

        await waitFor(() => expect(mockAddUserToRecipe).toHaveBeenCalledWith('R1', 'friend-1'));
        await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recipes', 'user-1'] }));
    });

    it('invalidates the recipes list cache after a user is removed', async () => {
        mockRemoveUserFromRecipe.mockResolvedValue({ id: 'R1', users: [] });
        const client = new QueryClient();
        const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

        const { result } = renderHook(() => useManageRecipeUsers({ recipeId: 'R1', userId: 'user-1' }), {
            wrapper: wrap(client),
        });

        result.current.removeUserMutation.mutate('friend-1');

        await waitFor(() => expect(mockRemoveUserFromRecipe).toHaveBeenCalledWith('R1', 'friend-1'));
        await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recipes', 'user-1'] }));
    });
});
