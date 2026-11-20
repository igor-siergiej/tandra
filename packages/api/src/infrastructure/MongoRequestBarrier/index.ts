import { type Collection, MongoServerError, ObjectId } from 'mongodb';

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
 * No expiring leases: a paused writer must never outlive its protection. A crashed holder fails closed;
 * recovery requires stopping all API replicas before clearing the requestBarrier collection.
 */
export class MongoRequestBarrier {
    private initialized?: Promise<unknown>;

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

    async acquire(exclusive: boolean): Promise<() => Promise<void>> {
        await this.initialize();
        const token = crypto.randomUUID();
        const deadline = Date.now() + ADMISSION_TIMEOUT_MS;

        const pause = async () => {
            if (Date.now() >= deadline) throw unavailable();
            await Bun.sleep(POLL_MS);
        };

        while (true) {
            const result = await this.collection.updateOne(
                { _id: KEY, writer: null },
                exclusive ? { $set: { writer: token } } : { $addToSet: { readers: token } }
            );

            if (result.matchedCount === 1) break;
            await pause();
        }

        const release = async () => {
            if (exclusive) {
                await this.collection.updateOne({ _id: KEY, writer: token }, { $set: { writer: null } });
            } else {
                await this.collection.updateOne({ _id: KEY }, { $pull: { readers: token } });
            }
        };

        if (exclusive) {
            try {
                // writer is already set, so no newly arriving request can join the readers we are draining.
                while (!(await this.collection.findOne({ _id: KEY, readers: { $size: 0 } }))) await pause();
            } catch (error) {
                await release();
                throw error;
            }
        }

        return release;
    }
}
