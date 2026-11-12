import { logger } from '../utils/logger';
import { type OutboxIntent, outboxStore } from './outboxStore';
import { replayIntent } from './replay';

// Statuses that may succeed on a later attempt: auth refresh, timeouts, throttling. Every other
// 4xx means the server has already judged this intent unusable (item gone, already renamed by
// someone else, name clash, no longer on the list, ...). Retrying never helps and a stuck head
// blocks every intent queued behind it, so those are dropped and the server's state wins.
const RETRYABLE_CLIENT_STATUSES = new Set([401, 408, 425, 429]);
let draining = false;

const statusOf = (err: unknown): number | undefined => {
    const status = err instanceof Error && 'status' in err ? err.status : undefined;

    return typeof status === 'number' ? status : undefined;
};

const isPermanentRejection = (status: number | undefined): status is number =>
    status !== undefined && status >= 400 && status < 500 && !RETRYABLE_CLIENT_STATUSES.has(status);

// Fired once after a drain pass that dropped at least one intent. The optimistic cache still
// shows the dropped change, so subscribers refetch to snap back to the server's state.
const discardListeners = new Set<() => void>();

export const onIntentsDiscarded = (cb: () => void): (() => void) => {
    discardListeners.add(cb);

    return () => discardListeners.delete(cb);
};

const notifyDiscarded = () => {
    for (const cb of discardListeners) cb();
};

type ReplayOutcome = 'sent' | 'discarded' | 'paused';

const replayOne = async (intent: OutboxIntent): Promise<ReplayOutcome> => {
    try {
        await replayIntent(intent);
        await outboxStore.remove(intent.seq);

        return 'sent';
    } catch (err) {
        const status = statusOf(err);

        if (!isPermanentRejection(status)) {
            logger.info('Drain paused (retryable error)', { op: intent.op, status });

            return 'paused';
        }

        logger.warn('Discarding rejected offline intent', { op: intent.op, status });
        await outboxStore.remove(intent.seq);

        return 'discarded';
    }
};

/** Replays the queue in order; resolves true when at least one intent was dropped. */
const drainPass = async (): Promise<boolean> => {
    let discarded = false;

    for (const intent of outboxStore.peekAll()) {
        const outcome = await replayOne(intent);

        if (outcome === 'paused') break;
        discarded = discarded || outcome === 'discarded';
    }

    return discarded;
};

export const drainOutbox = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    let discarded = false;

    try {
        discarded = await drainPass();
    } finally {
        draining = false;
    }

    if (discarded) notifyDiscarded();
};

let backoff = 0;

export const startDrainer = (): (() => void) => {
    const trigger = () => {
        if (!navigator.onLine) return;
        const before = outboxStore.count();
        void drainOutbox().then(() => {
            if (outboxStore.count() > 0 && outboxStore.count() === before) {
                backoff = Math.min(backoff ? backoff * 2 : 1000, 30000);
                setTimeout(trigger, backoff);
            } else {
                backoff = 0;
            }
        });
    };

    const onVisible = () => {
        if (document.visibilityState === 'visible') trigger();
    };

    window.addEventListener('online', trigger);
    document.addEventListener('visibilitychange', onVisible);
    trigger();

    return () => {
        window.removeEventListener('online', trigger);
        document.removeEventListener('visibilitychange', onVisible);
    };
};
