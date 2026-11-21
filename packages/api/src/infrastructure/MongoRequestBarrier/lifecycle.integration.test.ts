import { afterAll, describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'dotenv';
import { type CommandStartedEvent, MongoClient } from 'mongodb';

import { MongoRequestBarrier, type RequestBarrierState } from './index';

const rootEnv = join(import.meta.dir, '../../../../../.env');
const configuredUri = existsSync(rootEnv) ? parse(readFileSync(rootEnv)).CONNECTION_URI : undefined;
const uri = process.env.MONGO_TEST_URI ?? configuredUri ?? 'mongodb://localhost:27017';
const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 1500, monitorCommands: true });
const database = mongo.db(`tandra_barrier_lifecycle_${crypto.randomUUID().replaceAll('-', '')}`);
let mongoUp = false;

try {
    await mongo.connect();
    await database.command({ listCollections: 1 });
    mongoUp = true;
} catch {
    await mongo.close();
}

const deferred = () => {
    let resolve!: () => void;

    const promise = new Promise<void>((done) => {
        resolve = done;
    });

    return { promise, resolve };
};

const waitUntil = async (predicate: () => Promise<boolean>) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        if (await predicate()) return;
        // Real Mongo/child-process progress cannot be advanced by this process's fake clock.
        await Bun.sleep(10);
    }

    throw new Error('Request barrier did not make progress');
};

const observeRecovery = (collection: string) => {
    const retried = deferred();
    let passes = 0;

    const onCommand = (event: CommandStartedEvent) => {
        const filter = event.command.filter;

        if (
            event.commandName === 'find' &&
            event.command.find === collection &&
            filter?._id &&
            !('readers' in filter) &&
            ++passes === 2
        ) {
            retried.resolve();
        }
    };

    mongo.on('commandStarted', onCommand);

    return { promise: retried.promise, dispose: () => mongo.off('commandStarted', onCommand) };
};

const modes = [
    { name: 'reader', exclusive: false },
    { name: 'writer', exclusive: true },
];

const spawnHolder = (collection: string, exclusive: boolean) => {
    const acquired = deferred();

    const script = `
        import { MongoClient } from 'mongodb';
        import { MongoRequestBarrier } from ${JSON.stringify(new URL('./index.ts', import.meta.url).href)};
        const client = await new MongoClient(${JSON.stringify(uri)}).connect();
        const db = client.db(${JSON.stringify(database.databaseName)});
        const barrier = new MongoRequestBarrier(db.collection(${JSON.stringify(collection)}));
        const release = await barrier.acquire(${exclusive});
        process.on('message', async (message) => {
            if (message !== 'finish') return;
            await db.collection(${JSON.stringify(`${collection}_effects`)}).insertOne({ written: true });
            await release();
            await client.close();
            process.disconnect();
        });
        process.send('acquired');
    `;

    const child = Bun.spawn({
        cmd: [process.execPath, '--eval', script],
        stdout: 'ignore',
        stderr: 'inherit',
        ipc(message) {
            if (message === 'acquired') acquired.resolve();
        },
    });

    return {
        child,
        acquired: Promise.race([
            acquired.promise,
            child.exited.then((code) => {
                throw new Error(`Barrier holder exited before admission (status ${code})`);
            }),
        ]),
    };
};

describe.skipIf(!mongoUp || process.platform !== 'linux')('request barrier process ownership and shutdown', () => {
    afterAll(async () => {
        await database.dropDatabase();
        await mongo.close();
    });

    it.each(modes)('reclaims a killed $name after restart without clearing other live replicas', async (mode) => {
        const name = `killed_${mode.name}`;
        const collection = database.collection<RequestBarrierState>(name);
        const { child, acquired } = spawnHolder(name, mode.exclusive);
        const restarted = new MongoRequestBarrier(collection);
        const survivor = new MongoRequestBarrier(collection);
        let releaseSurvivor: (() => Promise<void>) | undefined;
        let releaseRestarted: (() => Promise<void>) | undefined;
        let pending: Promise<void> | undefined;

        try {
            await acquired;
            child.kill('SIGKILL');
            await child.exited;
            // A live reader in another replica must still be drained, not cleared alongside the dead owner.
            releaseSurvivor = await survivor.acquire(false);
            pending = restarted.acquire(true).then((release) => {
                releaseRestarted = release;
            });
            await waitUntil(async () => (await collection.findOne({ writer: { $ne: null } })) !== null);
            expect(releaseRestarted).toBeUndefined();
            await releaseSurvivor();
            releaseSurvivor = undefined;
            await waitUntil(async () => releaseRestarted !== undefined);
            await pending;
            await releaseRestarted!();
            releaseRestarted = undefined;
            expect(await collection.findOne({})).toMatchObject({ readers: [], writer: null });
        } finally {
            child.kill('SIGKILL');
            await child.exited;
            await releaseSurvivor?.();
            await releaseRestarted?.();
            await restarted.drain();
            await pending?.catch(() => {});
        }
    });

    it.each(modes)('never expires a paused $name before its external side effect finishes', async (mode) => {
        const name = `paused_${mode.name}`;
        const collection = database.collection<RequestBarrierState>(name);
        const effects = database.collection(`${name}_effects`);
        const { child, acquired } = spawnHolder(name, mode.exclusive);
        const deletingReplica = new MongoRequestBarrier(collection);
        const recovery = observeRecovery(name);
        let erased = false;
        let deletion: Promise<void> | undefined;

        try {
            await acquired;
            child.kill('SIGSTOP');
            deletion = deletingReplica.acquire(true).then(async (release) => {
                try {
                    expect(await effects.countDocuments({})).toBe(1);
                    await effects.deleteMany({});
                    erased = true;
                } finally {
                    await release();
                }
            });
            // Observe a complete recovery pass while SIGSTOP prevents all owner heartbeats and side effects.
            await recovery.promise;
            expect(erased).toBe(false);
            expect(await effects.countDocuments({})).toBe(0);
            child.kill('SIGCONT');
            child.send('finish');
            await child.exited;
            await deletion;
            expect(erased).toBe(true);
            expect(await effects.countDocuments({})).toBe(0);
        } finally {
            recovery.dispose();
            child.kill('SIGKILL');
            await child.exited;
            await deletingReplica.drain();
            await deletion?.catch(() => {});
        }
    });

    it.each(modes)('stops admission and drains an active $name before shutdown completes', async (mode) => {
        const collection = database.collection<RequestBarrierState>(`drain_${mode.name}`);
        const barrier = new MongoRequestBarrier(collection);
        const release = await barrier.acquire(mode.exclusive);
        let drained = false;

        const draining = barrier.drain().then(() => {
            drained = true;
        });

        try {
            await Promise.resolve();
            expect(drained).toBe(false);
            await expect(barrier.acquire(false)).rejects.toMatchObject({ status: 503 });
            await release();
            await draining;
            expect(drained).toBe(true);
            expect(await collection.findOne({})).toMatchObject({ readers: [], writer: null });
            await expect(barrier.acquire(true)).rejects.toMatchObject({ status: 503 });
        } finally {
            await release();
        }
    });

    it('cancels queued local admissions during shutdown without releasing a remote holder', async () => {
        const collection = database.collection<RequestBarrierState>('queued_shutdown');
        const remote = new MongoRequestBarrier(collection);
        const barrier = new MongoRequestBarrier(collection);
        const release = await remote.acquire(true);
        const queued = barrier.acquire(false);

        // Collect the outcome without blocking: Bun's `.rejects` spins the event loop until the promise settles.
        const outcome = queued.then(
            () => 'admitted',
            (error: { status?: number }) => error.status
        );

        try {
            await barrier.drain();
            expect(await outcome).toBe(503);
            expect((await collection.findOne({}))?.writer).not.toBeNull();
        } finally {
            await release();
        }
    });

    it.each(
        modes.flatMap((mode) =>
            ['legacy', 'remote boot', 'remote namespace'].map((identity) => ({ ...mode, identity }))
        )
    )('keeps an unidentifiable $identity $name failclosed rather than guessing it died', async (mode) => {
        const name = `unknown_${mode.name}_${mode.identity.replaceAll(' ', '_')}`;
        const collection = database.collection<RequestBarrierState>(name);
        const initializer = new MongoRequestBarrier(collection);
        const release = await initializer.acquire(false);
        const sample = (await collection.findOne({}))!.readers[0]!;
        await release();
        const parsed = JSON.parse(sample) as { owner: { bootId: string; namespace: string } | null };
        let token = 'legacy-owner';

        if (mode.identity !== 'legacy') {
            // Both scopes are unknowable locally even when their recorded PID happens to exist here.
            if (!parsed.owner) throw new Error('Linux process ownership is unavailable');

            if (mode.identity === 'remote boot') parsed.owner.bootId = 'another-machine-or-boot';
            else parsed.owner.namespace = 'another-pid-namespace';
            token = JSON.stringify(parsed);
        }

        await collection.updateOne({}, mode.exclusive ? { $set: { writer: token } } : { $set: { readers: [token] } });
        const barrier = new MongoRequestBarrier(collection);
        const recovery = observeRecovery(name);
        let entered = false;

        const pending = barrier.acquire(true).then(async (release) => {
            entered = true;
            await release();
        });

        try {
            await recovery.promise;
            expect(entered).toBe(false);
        } finally {
            recovery.dispose();
            await collection.updateOne({}, { $set: { writer: null, readers: [] } });
            await pending;
            await barrier.drain();
        }
    });
});
