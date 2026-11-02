import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../offline/drainer', () => ({ drainOutbox: vi.fn().mockResolvedValue(undefined) }));

vi.mock('./useFriends', () => ({
    useFriends: () => ({
        friends: [{ id: 'friend-1', username: 'alice' }],
        isLoading: false,
    }),
}));

import { drainOutbox } from '../offline/drainer';
import { outboxStore } from '../offline/outboxStore';
import { useRecipeMutations } from './useRecipeMutations';

const user = { id: 'user-1', username: 'me' };

const wrap =
    (client: QueryClient) =>
    ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe('useRecipeMutations', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('createRecipe enqueues a recipe.create intent and optimistically adds it', async () => {
        const client = new QueryClient();
        client.setQueryData(['recipes', 'user-1'], []);
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });
        await act(async () => {
            await result.current.createRecipe('Pasta', [], []);
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        expect(outboxStore.peekAll()[0]).toMatchObject({ op: 'recipe.create', entityType: 'recipe', scope: 'user-1' });
        const cached = client.getQueryData(['recipes', 'user-1']) as Array<{ title: string }>;
        expect(cached.map((r) => r.title)).toContain('Pasta');
    });

    it('createRecipe includes selected friends in the optimistic users list', async () => {
        const client = new QueryClient();
        client.setQueryData(['recipes', 'user-1'], []);
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });
        await act(async () => {
            await result.current.createRecipe('Pasta', ['friend-1'], []);
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));

        const cached = client.getQueryData(['recipes', 'user-1']) as Array<{
            title: string;
            users: Array<{ id: string }>;
        }>;

        const created = cached.find((r) => r.title === 'Pasta');
        expect(created?.users.map((u) => u.id).sort()).toEqual(['friend-1', 'user-1']);
    });

    it('deleteRecipe enqueues a recipe.delete intent', async () => {
        const client = new QueryClient();
        client.setQueryData(
            ['recipes', 'user-1'],
            [{ id: 'R1', title: 'Pasta', ingredients: [], ownerId: 'user-1', users: [], dateAdded: new Date() }]
        );
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });
        await act(async () => {
            await result.current.deleteRecipe('R1');
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        expect(outboxStore.peekAll()[0]).toMatchObject({ op: 'recipe.delete', targetId: 'R1' });
    });

    it('createRecipe does not resolve until the create intent has drained', async () => {
        let resolveDrain: () => void = () => {};

        vi.mocked(drainOutbox).mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveDrain = resolve;
                })
        );

        const client = new QueryClient();
        client.setQueryData(['recipes', 'user-1'], []);
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });

        let created = false;

        const createPromise = result.current.createRecipe('Pasta', [], []).then(() => {
            created = true;
        });

        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        expect(created).toBe(false);

        resolveDrain();
        await createPromise;
        expect(created).toBe(true);

        vi.mocked(drainOutbox).mockResolvedValue(undefined);
    });

    it('updateRecipe enqueues a recipe.update intent and patches list + detail caches', async () => {
        const existingRecipe = {
            id: 'R2',
            title: 'Old Title',
            ingredients: [],
            ownerId: 'user-1',
            users: [user],
            dateAdded: new Date(),
        };

        const client = new QueryClient();
        client.setQueryData(['recipes', 'user-1'], [existingRecipe]);
        client.setQueryData(['recipe', 'R2'], existingRecipe);
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });
        await act(async () => {
            await result.current.updateRecipe('R2', 'New Title', []);
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        expect(outboxStore.peekAll()[0]).toMatchObject({ op: 'recipe.update', targetId: 'R2' });
        const list = client.getQueryData(['recipes', 'user-1']) as Array<{ id: string; title: string }>;
        expect(list.find((r) => r.id === 'R2')?.title).toBe('New Title');
        const detail = client.getQueryData(['recipe', 'R2']) as { title: string };
        expect(detail.title).toBe('New Title');
    });

    it('createRecipe includes prepTime, cookTime, servings and difficulty in the optimistic update', async () => {
        const client = new QueryClient();
        client.setQueryData(['recipes', 'user-1'], []);
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });
        await act(async () => {
            await result.current.createRecipe('Pasta', [], [], undefined, undefined, undefined, 10, 20, 4, 'easy');
        });

        const cached = client.getQueryData(['recipes', 'user-1']) as Array<{
            title: string;
            prepTime?: number;
            cookTime?: number;
            servings?: number;
            difficulty?: string;
        }>;

        const created = cached.find((r) => r.title === 'Pasta');
        expect(created).toMatchObject({ prepTime: 10, cookTime: 20, servings: 4, difficulty: 'easy' });
    });

    it('updateRecipe patches prepTime, cookTime, servings and difficulty in the detail cache', async () => {
        const existingRecipe = {
            id: 'R3',
            title: 'Pasta',
            ingredients: [],
            ownerId: 'user-1',
            users: [user],
            dateAdded: new Date(),
        };

        const client = new QueryClient();
        client.setQueryData(['recipes', 'user-1'], [existingRecipe]);
        client.setQueryData(['recipe', 'R3'], existingRecipe);
        const { result } = renderHook(() => useRecipeMutations(user), { wrapper: wrap(client) });
        await act(async () => {
            await result.current.updateRecipe(
                'R3',
                'Pasta',
                [],
                undefined,
                undefined,
                undefined,
                undefined,
                15,
                25,
                6,
                'hard'
            );
        });

        const detail = client.getQueryData(['recipe', 'R3']) as {
            prepTime?: number;
            cookTime?: number;
            servings?: number;
            difficulty?: string;
        };

        expect(detail).toMatchObject({ prepTime: 15, cookTime: 25, servings: 6, difficulty: 'hard' });
    });
});
