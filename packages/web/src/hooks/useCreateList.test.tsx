import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../offline/drainer', () => ({ drainOutbox: vi.fn().mockResolvedValue(undefined) }));

import { GuestProvider } from '../guest/GuestContext';
import { outboxStore } from '../offline/outboxStore';
import { useCreateList } from './useCreateList';

const user = { id: 'user-1', username: 'me' };

const wrap =
    (client: QueryClient) =>
    ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
            <GuestProvider>{children}</GuestProvider>
        </QueryClientProvider>
    );

describe('useCreateList', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('enqueues a list.create intent and optimistically adds the list', async () => {
        const client = new QueryClient();
        client.setQueryData(['lists', 'user-1'], []);
        const { result } = renderHook(() => useCreateList(user), { wrapper: wrap(client) });

        await act(async () => {
            await result.current('Groceries', 'shopping' as never, []);
        });

        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('list.create');
        expect(intent.scope).toBe('user-1');
        expect(intent.payload).toMatchObject({ title: 'Groceries' });
        const cached = client.getQueryData(['lists', 'user-1']) as Array<{ title: string }>;
        expect(cached.map((l) => l.title)).toContain('Groceries');
    });
});
