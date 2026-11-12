import 'fake-indexeddb/auto';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { clearUserData } from './clearUserData';
import { outboxStore } from './outboxStore';

const intent = () => ({
    id: crypto.randomUUID(),
    entityType: 'item' as const,
    op: 'item.toggle' as const,
    targetId: 'x1',
    scope: 'My List',
    payload: {},
    createdAt: Date.now(),
});

describe('clearUserData', () => {
    const deleteCache = vi.fn().mockResolvedValue(true);

    beforeEach(async () => {
        await outboxStore._resetForTests();
        deleteCache.mockClear();
        vi.stubGlobal('caches', { delete: deleteCache });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('deletes the service worker api cache', async () => {
        await clearUserData(new QueryClient());

        expect(deleteCache).toHaveBeenCalledWith('api-cache');
    });

    it("drops the previous user's unsent offline changes", async () => {
        await outboxStore.enqueue(intent());

        await clearUserData(new QueryClient());

        expect(outboxStore.count()).toBe(0);
        await outboxStore.hydrate();
        expect(outboxStore.count()).toBe(0);
    });

    it('empties the in-memory query cache', async () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(['Groceries'], { items: ['milk'] });

        await clearUserData(queryClient);

        expect(queryClient.getQueryData(['Groceries'])).toBeUndefined();
    });

    it('still clears the rest when the Cache API is unavailable', async () => {
        vi.stubGlobal('caches', undefined);
        await outboxStore.enqueue(intent());

        await clearUserData(new QueryClient());

        expect(outboxStore.count()).toBe(0);
    });

    it('still clears the outbox when cache deletion rejects', async () => {
        deleteCache.mockRejectedValueOnce(new Error('boom'));
        await outboxStore.enqueue(intent());

        await clearUserData(new QueryClient());

        expect(outboxStore.count()).toBe(0);
    });
});
