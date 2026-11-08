import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../api';
import { fake } from '../testing/fake';
import { useFriends, useRedeemFriendCode } from './useFriends';

vi.mock('../api', async (importOriginal) => {
    const actual = await importOriginal<typeof api>();

    return { ...actual };
});

const wrap =
    (client: QueryClient) =>
    ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe('useFriends', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the mocked friends list', async () => {
        vi.spyOn(api, 'getFriendsQuery').mockReturnValue(
            fake({
                queryKey: ['friends'],
                queryFn: async () => [{ id: 'f1', username: 'alice' }],
            })
        );

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { result } = renderHook(() => useFriends(), { wrapper: wrap(client) });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.friends).toEqual([{ id: 'f1', username: 'alice' }]);
    });
});

describe('useRedeemFriendCode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('invalidates the friends query on success', async () => {
        vi.spyOn(api, 'redeemFriendCode').mockResolvedValue(fake({ friend: { id: 'f2', username: 'bob' } }));

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
        const { result } = renderHook(() => useRedeemFriendCode(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.mutateAsync('ABC123');
        });

        await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['friends'] }));
    });
});
