import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../offline/drainer', () => ({ drainOutbox: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../auth', () => ({ useUser: () => ({ user: { id: 'user-1', username: 'me' } }) }));

import { outboxStore } from '../offline/outboxStore';
import { useLabels } from './useLabels';

const wrap =
    (client: QueryClient) =>
    ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe('useLabels offline', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('createLabel enqueues a label.create intent with ownerId in payload', async () => {
        const client = new QueryClient();
        client.setQueryData(['labels'], []);
        const { result } = renderHook(() => useLabels(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.createLabel({ name: 'Home', color: '#fff' });
        });

        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('label.create');
        expect(intent.entityType).toBe('label');
        expect(intent.scope).toBe('user-1');
        expect(intent.payload).toMatchObject({ name: 'Home', color: '#fff', ownerId: 'user-1' });
    });

    it('createLabel optimistically adds label to cache', async () => {
        const client = new QueryClient();
        client.setQueryData(['labels'], []);
        const { result } = renderHook(() => useLabels(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.createLabel({ name: 'Work', color: '#000' });
        });

        await waitFor(() => {
            const labels = client.getQueryData<{ name: string; ownerId: string }[]>(['labels']);
            const found = labels?.find((l) => l.name === 'Work');
            expect(found).toBeDefined();
            expect(found?.ownerId).toBe('user-1');
        });
    });

    it('updateLabel enqueues a label.update intent', async () => {
        const client = new QueryClient();
        client.setQueryData(['labels'], [{ id: 'l1', name: 'Old', color: '#111', ownerId: 'user-1' }]);
        const { result } = renderHook(() => useLabels(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.updateLabel('l1', { name: 'New' });
        });

        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('label.update');
        expect(intent.targetId).toBe('l1');
        expect(intent.scope).toBe('user-1');
        expect(intent.payload).toMatchObject({ name: 'New' });
    });

    it('updateLabel optimistically patches the cache', async () => {
        const client = new QueryClient();
        client.setQueryData(['labels'], [{ id: 'l1', name: 'Old', color: '#111', ownerId: 'user-1' }]);
        const { result } = renderHook(() => useLabels(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.updateLabel('l1', { name: 'New' });
        });

        await waitFor(() => {
            const labels = client.getQueryData<{ id: string; name: string }[]>(['labels']);
            expect(labels?.find((l) => l.id === 'l1')?.name).toBe('New');
        });
    });

    it('deleteLabel enqueues a label.delete intent', async () => {
        const client = new QueryClient();
        client.setQueryData(['labels'], [{ id: 'l2', name: 'Del', color: '#222', ownerId: 'user-1' }]);
        const { result } = renderHook(() => useLabels(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.deleteLabel('l2');
        });

        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('label.delete');
        expect(intent.targetId).toBe('l2');
        expect(intent.scope).toBe('user-1');
    });

    it('deleteLabel optimistically removes label from cache', async () => {
        const client = new QueryClient();
        client.setQueryData(['labels'], [{ id: 'l2', name: 'Del', color: '#222', ownerId: 'user-1' }]);
        const { result } = renderHook(() => useLabels(), { wrapper: wrap(client) });

        await act(async () => {
            await result.current.deleteLabel('l2');
        });

        await waitFor(() => {
            const labels = client.getQueryData<{ id: string }[]>(['labels']);
            expect(labels?.find((l) => l.id === 'l2')).toBeUndefined();
        });
    });
});
