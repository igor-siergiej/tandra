import type { Todo } from '@tandra/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type CreateTodoBody, getTodosQuery, type UpdateTodoBody } from '../api';
import { useUser } from '../auth';
import { drainOutbox } from '../offline/drainer';
import { applyTodoIntent } from '../offline/intents';
import { type OutboxIntent, outboxStore } from '../offline/outboxStore';

export const useTodos = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const userId = user?.id ?? '';

    const { data, isLoading, isError, refetch } = useQuery<Todo[]>(getTodosQuery(userId));

    const enqueueTodo = async (op: OutboxIntent['op'], targetId: string, payload: Record<string, unknown>) => {
        const intent = {
            id: crypto.randomUUID(),
            entityType: 'todo' as const,
            op,
            targetId,
            scope: userId,
            payload,
            createdAt: Date.now(),
        };
        queryClient.setQueryData<Todo[]>(['todos'], (old) => applyTodoIntent(old ?? [], intent as OutboxIntent));
        await outboxStore.enqueue(intent);
        void drainOutbox();
    };

    return {
        todos: data ?? [],
        isLoading,
        isError,
        refetch,
        createTodo: (body: CreateTodoBody) =>
            enqueueTodo('todo.create', crypto.randomUUID(), { ...body, ownerId: userId }),
        updateTodo: (id: string, body: UpdateTodoBody) =>
            enqueueTodo('todo.update', id, body as Record<string, unknown>),
        deleteTodo: (id: string) => enqueueTodo('todo.delete', id, {}),
        completeTodo: (id: string, date?: string) =>
            enqueueTodo('todo.complete', id, date !== undefined ? { date } : {}),
    };
};
