import 'fake-indexeddb/auto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { outboxStore } from '../offline/outboxStore';
import { usePendingItemIds } from './usePendingItemIds';

const enqueue = (entityType: 'item' | 'list', scope: string, targetId: string) =>
    outboxStore.enqueue({
        id: crypto.randomUUID(),
        entityType,
        op: entityType === 'item' ? 'item.toggle' : 'list.create',
        targetId,
        scope,
        payload: {},
        createdAt: Date.now(),
    });

describe('usePendingItemIds', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    afterEach(async () => {
        await outboxStore._resetForTests();
    });

    it('lists only item intents of the given list and clears once they are removed', async () => {
        const { result } = renderHook(() => usePendingItemIds('Groceries'));
        expect(result.current.size).toBe(0);

        let queued: Awaited<ReturnType<typeof enqueue>>;
        await act(async () => {
            queued = await enqueue('item', 'Groceries', 'a');
            await enqueue('item', 'Other list', 'b');
            await enqueue('list', 'Groceries', 'c');
        });

        expect([...result.current]).toEqual(['a']);

        await act(async () => {
            await outboxStore.remove(queued.seq);
        });

        expect(result.current.size).toBe(0);
    });
});
