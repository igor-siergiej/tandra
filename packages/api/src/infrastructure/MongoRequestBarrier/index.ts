import { type Collection, MongoServerError, ObjectId } from 'mongodb';

import { createRequestToken, isDeadRequestToken } from './processOwnership';

export interface RequestBarrierState {
    _id: ObjectId;
    writer: string | null;
    readers: string[];
}

const KEY = new ObjectId('000000000000000000000114');
const ADMISSION_TIMEOUT_MS = 60_000;
const POLL_MS = 20;
const unavailable = () => Object.assign(new Error('Account cleanup is busy; please try again'), { status: 503 });

/**
 * Cross-replica read/write barrier. Requests normally share admission; destructive deletes close admission,
 * drain existing requests, then run alone. Authentication must happen INSIDE admission, not before it.
 * No expiring leases: a paused writer must never outlive its protection. Only provably dead processes in
 * this Linux boot/PID namespace can be reclaimed; unknown remote and legacy holders remain failclosed.
 */
export class MongoRequestBarrier {
    private initialized?: Promise<unknown>;
    private accepting = true;
    private active = 0;
    private draining?: Promise<void>;
    private resolveDrained?: () => void;

    constructor(private readonly collection: Collection<RequestBarrierState>) {}

    private initialize(): Promise<unknown> {
        return (this.initialized ??= this.collection
            .updateOne({ _id: KEY }, { $setOnInsert: { writer: null, readers: [] } }, { upsert: true })
            .catch((error: unknown) => {
                this.initialized = undefined;

                // Two replicas may insert the singleton simultaneously; the winner has initialized it for both.
                if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
            }));
    }

    drain(): Promise<void> {
        this.accepting = false;

        return (this.draining ??=
            this.active === 0
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                      this.resolveDrained = resolve;
                  }));
    }

    private async reclaimDeadHolders(): Promise<void> {
        const state = await this.collection.findOne({ _id: KEY });

        if (!state) return;

        if (state.writer && (await isDeadRequestToken(state.writer))) {
            // Compare the exact token: a replacement writer must never lose its fence.
            await this.collection.updateOne({ _id: KEY, writer: state.writer }, { $set: { writer: null } });
        }

        const deadReaders: string[] = [];

        for (const token of state.readers) {
            if (await isDeadRequestToken(token)) deadReaders.push(token);
        }

        if (deadReaders.length) {
            await this.collection.updateOne({ _id: KEY }, { $pull: { readers: { $in: deadReaders } } });
        }
    }

    async acquire(exclusive: boolean): Promise<() => Promise<void>> {
        if (!this.accepting) throw unavailable();
        this.active += 1;
        let token: string | undefined;
        let held = false;
        let released: Promise<void> | undefined;
        const deadline = Date.now() + ADMISSION_TIMEOUT_MS;

        const release = (): Promise<void> =>
            (released ??= (async () => {
                try {
                    if (!held || !token) return;

                    if (exclusive) {
                        await this.collection.updateOne({ _id: KEY, writer: token }, { $set: { writer: null } });
                    } else {
                        await this.collection.updateOne({ _id: KEY }, { $pull: { readers: token } });
                    }
                } finally {
                    this.active -= 1;

                    if (this.active === 0) this.resolveDrained?.();
                }
            })());

        const pause = async () => {
            if (!this.accepting || Date.now() >= deadline) throw unavailable();
            await Bun.sleep(POLL_MS);
        };

        try {
            await this.initialize();
            token = await createRequestToken();

            while (true) {
                if (!this.accepting) throw unavailable();

                const result = await this.collection.updateOne(
                    { _id: KEY, writer: null },
                    exclusive ? { $set: { writer: token } } : { $addToSet: { readers: token } }
                );

                if (result.matchedCount === 1) {
                    held = true;
                    break;
                }

                await this.reclaimDeadHolders();
                await pause();
            }

            if (exclusive) {
                // Admission is already closed globally; reclaim only dead readers while draining live ones.
                while (!(await this.collection.findOne({ _id: KEY, readers: { $size: 0 } }))) {
                    await this.reclaimDeadHolders();
                    await pause();
                }
            }

            // Shutdown may have started while a Mongo operation was in flight.
            if (!this.accepting) throw unavailable();

            return release;
        } catch (error) {
            await release();
            throw error;
        }
    }
}
