import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { replayIntent } = vi.hoisted(() => ({ replayIntent: vi.fn() }));

vi.mock('./replay', () => ({ replayIntent }));

import { drainOutbox, onIntentsDiscarded } from './drainer';
import { outboxStore } from './outboxStore';

const enq = (over = {}) =>
    outboxStore.enqueue({
        id: crypto.randomUUID(),
        entityType: 'item',
        op: 'item.toggle',
        targetId: 'x',
        scope: 'L',
        payload: { isSelected: true },
        createdAt: 0,
        ...over,
    });

describe('drainOutbox', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
        replayIntent.mockReset();
    });

    it('replays in order and clears the queue on success', async () => {
        await enq({ targetId: 'a' });
        await enq({ targetId: 'b' });
        replayIntent.mockResolvedValue(undefined);
        await drainOutbox();
        expect(replayIntent.mock.calls.map((c) => c[0].targetId)).toEqual(['a', 'b']);
        expect(outboxStore.count()).toBe(0);
    });

    it('discards an intent that fails with 404', async () => {
        await enq();
        replayIntent.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }));
        await drainOutbox();
        expect(outboxStore.count()).toBe(0);
    });

    it('discards on 409 conflict', async () => {
        await enq();
        replayIntent.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
        await drainOutbox();
        expect(outboxStore.count()).toBe(0);
    });

    it('discards a 400 rejection and keeps draining the intents queued behind it', async () => {
        await enq({ targetId: 'same-name-rename' });
        await enq({ targetId: 'next' });
        replayIntent
            .mockRejectedValueOnce(Object.assign(new Error('must differ'), { status: 400 }))
            .mockResolvedValue(undefined);
        await drainOutbox();
        expect(replayIntent.mock.calls.map((c) => c[0].targetId)).toEqual(['same-name-rename', 'next']);
        expect(outboxStore.count()).toBe(0);
    });

    it.each([401, 408, 429])('keeps the queue on a retryable %i', async (status) => {
        await enq({ targetId: 'a' });
        await enq({ targetId: 'b' });
        replayIntent.mockRejectedValueOnce(Object.assign(new Error('retry'), { status }));
        await drainOutbox();
        expect(outboxStore.count()).toBe(2);
    });

    it('notifies subscribers once when a drain pass dropped intents, so caches can resync', async () => {
        await enq({ targetId: 'a' });
        await enq({ targetId: 'b' });
        replayIntent.mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }));
        const cb = vi.fn();
        const off = onIntentsDiscarded(cb);
        await drainOutbox();
        off();
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not notify when nothing was dropped', async () => {
        await enq();
        replayIntent.mockResolvedValue(undefined);
        const cb = vi.fn();
        const off = onIntentsDiscarded(cb);
        await drainOutbox();
        off();
        expect(cb).not.toHaveBeenCalled();
    });

    it('stops and keeps the queue on a 5xx error (preserves order)', async () => {
        await enq({ targetId: 'a' });
        await enq({ targetId: 'b' });
        replayIntent.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
        await drainOutbox();
        expect(outboxStore.count()).toBe(2);
    });

    it('stops on a network error with no status', async () => {
        await enq();
        replayIntent.mockRejectedValue(new TypeError('Failed to fetch'));
        await drainOutbox();
        expect(outboxStore.count()).toBe(1);
    });
});
