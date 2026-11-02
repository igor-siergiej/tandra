import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Api from '../api';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof Api>()),
    updateItem: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
    updateItemName: vi.fn().mockResolvedValue(undefined),
    updateItemQuantity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../offline/drainer', () => ({ drainOutbox: vi.fn().mockResolvedValue(undefined) }));

import { GuestProvider } from '../guest/GuestContext';
import { outboxStore } from '../offline/outboxStore';
import { useItemMutations } from './useItemMutations';

const wrap =
    (client: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>
            <GuestProvider>{children}</GuestProvider>
        </QueryClientProvider>
    );

describe('useItemMutations (id-addressed)', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('toggle enqueues an outbox intent and triggers a drain', async () => {
        const client = new QueryClient();
        client.setQueryData(['My List'], {
            listType: 'shopping',
            items: [{ id: 'x1', name: 'Milk', isSelected: false }],
        });
        const { result } = renderHook(() => useItemMutations('My List', 'x1'), { wrapper: wrap(client) });
        act(() => {
            result.current.toggleMutation.mutate(true);
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('item.toggle');
        expect(intent.targetId).toBe('x1');
        expect(intent.payload).toEqual({ isSelected: true });
    });

    it('toggle optimistically updates the item matched by id', async () => {
        const client = new QueryClient();
        client.setQueryData(['My List'], {
            listType: 'shopping',
            items: [{ id: 'x1', name: 'Milk', isSelected: false }],
        });
        const { result } = renderHook(() => useItemMutations('My List', 'x1'), { wrapper: wrap(client) });
        act(() => {
            result.current.toggleMutation.mutate(true);
        });
        await waitFor(() => {
            const data = client.getQueryData(['My List']) as { items: { id: string; isSelected: boolean }[] };
            expect(data.items[0].isSelected).toBe(true);
        });
    });

    it('delete removes the item matched by id', async () => {
        const client = new QueryClient();
        client.setQueryData(['My List'], {
            listType: 'shopping',
            items: [
                { id: 'x1', name: 'Milk' },
                { id: 'x2', name: 'Bread' },
            ],
        });
        const { result } = renderHook(() => useItemMutations('My List', 'x1'), { wrapper: wrap(client) });
        act(() => {
            result.current.deleteMutation.mutate(undefined);
        });
        await waitFor(() => {
            const data = client.getQueryData(['My List']) as { items: { id: string }[] };
            expect(data.items.map((i) => i.id)).toEqual(['x2']);
        });
    });
});
