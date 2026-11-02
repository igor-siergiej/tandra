import type { Label } from '@tandra/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getLabelsQuery } from '../api';
import { useUser } from '../auth';
import { drainOutbox } from '../offline/drainer';
import { applyLabelIntent } from '../offline/intents';
import { type OutboxIntent, outboxStore } from '../offline/outboxStore';

export const useLabels = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const userId = user?.id ?? '';

    const { data, isLoading, refetch } = useQuery<Label[]>(getLabelsQuery(userId));

    const enqueueLabel = async (op: OutboxIntent['op'], targetId: string, payload: Record<string, unknown>) => {
        const intent = {
            id: crypto.randomUUID(),
            entityType: 'label' as const,
            op,
            targetId,
            scope: userId,
            payload,
            createdAt: Date.now(),
        };
        queryClient.setQueryData<Label[]>(['labels'], (old) => applyLabelIntent(old ?? [], intent as OutboxIntent));
        await outboxStore.enqueue(intent);
        void drainOutbox();
    };

    return {
        labels: data ?? [],
        isLoading,
        refetch,
        createLabel: (body: { name: string; color: string }) =>
            enqueueLabel('label.create', crypto.randomUUID(), { ...body, ownerId: userId }),
        updateLabel: (id: string, body: { name?: string; color?: string }) =>
            enqueueLabel('label.update', id, body as Record<string, unknown>),
        deleteLabel: (id: string) => enqueueLabel('label.delete', id, {}),
    };
};
