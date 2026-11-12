import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { outboxStore } from './outboxStore';

const intent = (over = {}) => ({
    id: crypto.randomUUID(),
    entityType: 'item' as const,
    op: 'item.toggle' as const,
    targetId: 'x1',
    scope: 'My List',
    payload: { isSelected: true },
    createdAt: Date.now(),
    ...over,
});

describe('outboxStore', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('enqueue assigns increasing seq and persists', async () => {
        const a = await outboxStore.enqueue(intent());
        const b = await outboxStore.enqueue(intent());
        expect(b.seq).toBeGreaterThan(a.seq);
        expect(outboxStore.peekAll().map((i) => i.seq)).toEqual([a.seq, b.seq]);
        expect(outboxStore.count()).toBe(2);
    });

    it('remove deletes by seq', async () => {
        const a = await outboxStore.enqueue(intent());
        await outboxStore.enqueue(intent());
        await outboxStore.remove(a.seq);
        expect(outboxStore.peekAll().map((i) => i.targetId)).toHaveLength(1);
    });

    it('hydrate reloads the mirror from IndexedDB', async () => {
        await outboxStore.enqueue(intent());
        await outboxStore.hydrate();
        expect(outboxStore.count()).toBe(1);
    });

    it('subscribe fires on enqueue and remove', async () => {
        let calls = 0;

        const unsub = outboxStore.subscribe(() => {
            calls += 1;
        });

        const a = await outboxStore.enqueue(intent());
        await outboxStore.remove(a.seq);
        unsub();
        expect(calls).toBe(2);
    });
});
