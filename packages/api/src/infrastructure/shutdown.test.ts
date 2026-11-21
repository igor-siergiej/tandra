import { expect, it } from 'bun:test';

import { drainServer } from './shutdown';

it('closes admission and stops listening before draining, then closes remaining sockets', async () => {
    let finishRequests!: () => void;
    let finishSockets!: () => void;

    const requests = new Promise<void>((resolve) => {
        finishRequests = resolve;
    });

    const sockets = new Promise<void>((resolve) => {
        finishSockets = resolve;
    });

    const events: string[] = [];

    const barrier = {
        drain: () => {
            events.push('close admission');

            return requests;
        },
    };

    const server = {
        stop: (closeActiveConnections = false) => {
            events.push(closeActiveConnections ? 'close sockets' : 'stop listening');

            if (closeActiveConnections) finishSockets();

            return sockets;
        },
    };

    let stopped = false;

    const shutdown = drainServer(server, barrier).then(() => {
        stopped = true;
    });

    expect(events).toEqual(['close admission', 'stop listening']);
    expect(stopped).toBe(false);
    finishRequests();
    await shutdown;
    expect(events).toEqual(['close admission', 'stop listening', 'close sockets']);
    expect(stopped).toBe(true);
});
