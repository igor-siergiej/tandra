import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import * as api from '../api';
import { outboxStore } from '../offline/outboxStore';
import { useTodos } from './useTodos';

vi.mock('../auth', () => ({
    useUser: () => ({ user: { id: 'user-1', username: 'testuser' } }),
}));

vi.mock('../offline/drainer', () => ({ drainOutbox: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../api', async (importOriginal) => {
    const actual = await importOriginal<typeof api>();

    return {
        ...actual,
        getTodosQuery: actual.getTodosQuery,
    };
});

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useTodos', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await outboxStore._resetForTests();
    });

    it('loads todos', async () => {
        vi.spyOn(api, 'getTodosQuery').mockReturnValue({
            queryKey: ['todos'],
            queryFn: async () => [{ id: 't1', ownerId: 'u', title: 'A', done: false, dateAdded: new Date() }],
        } as never);

        const { result } = renderHook(() => useTodos(), { wrapper });
        await waitFor(() => expect(result.current.todos).toHaveLength(1));
        expect(result.current.todos[0].title).toBe('A');
    });

    it('createTodo enqueues a todo.create intent and optimistically adds it', async () => {
        vi.spyOn(api, 'getTodosQuery').mockReturnValue({ queryKey: ['todos'], queryFn: async () => [] } as never);

        const { result } = renderHook(() => useTodos(), { wrapper });
        await act(async () => {
            await result.current.createTodo({ title: 'Buy milk' });
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('todo.create');
        expect(intent.entityType).toBe('todo');
        expect(intent.scope).toBe('user-1');
        expect(intent.payload).toMatchObject({ title: 'Buy milk' });
    });

    it('createTodo optimistically adds todo to cache', async () => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });

        client.setQueryData(['todos'], []);
        vi.spyOn(api, 'getTodosQuery').mockReturnValue({ queryKey: ['todos'], queryFn: async () => [] } as never);

        const localWrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useTodos(), { wrapper: localWrapper });
        await act(async () => {
            await result.current.createTodo({ title: 'Buy milk' });
        });
        await waitFor(() => {
            const todos = client.getQueryData<{ id: string; title: string }[]>(['todos']);
            expect(todos?.some((t) => t.title === 'Buy milk')).toBe(true);
        });
    });

    it('deleteTodo enqueues a todo.delete intent', async () => {
        vi.spyOn(api, 'getTodosQuery').mockReturnValue({ queryKey: ['todos'], queryFn: async () => [] } as never);

        const { result } = renderHook(() => useTodos(), { wrapper });
        await act(async () => {
            await result.current.deleteTodo('t1');
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('todo.delete');
        expect(intent.targetId).toBe('t1');
    });

    it('completeTodo enqueues a todo.complete intent with date payload', async () => {
        vi.spyOn(api, 'getTodosQuery').mockReturnValue({ queryKey: ['todos'], queryFn: async () => [] } as never);

        const { result } = renderHook(() => useTodos(), { wrapper });
        await act(async () => {
            await result.current.completeTodo('t1', '2026-06-04');
        });
        await waitFor(() => expect(outboxStore.peekAll()).toHaveLength(1));
        const intent = outboxStore.peekAll()[0];
        expect(intent.op).toBe('todo.complete');
        expect(intent.payload).toEqual({ date: '2026-06-04' });
    });
});
