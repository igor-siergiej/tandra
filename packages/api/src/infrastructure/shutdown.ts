import type { MongoRequestBarrier } from './MongoRequestBarrier';

export const drainServer = async (
    server: { stop: (closeActiveConnections?: boolean) => void | Promise<void> },
    barrier: Pick<MongoRequestBarrier, 'drain'>
): Promise<void> => {
    const draining = barrier.drain();
    const stopped = server.stop(false);

    // Live websocket/keepalive connections must not prevent exit, but never interrupt admitted side effects.
    await Promise.all([draining.then(() => server.stop(true)), stopped]);
};
