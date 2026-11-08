import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake } from '../testing/fake';
import { openListSocket, type Viewer } from './listSocket';

/** A message as the server sends it over the list socket. */
type ServerMessage = { type: 'changed' | 'presence'; users?: Viewer[] };

class FakeSocket {
    static instances: FakeSocket[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: ((e: { code: number }) => void) | null = null;
    closed = false;
    constructor(public url: string) {
        FakeSocket.instances.push(this);
    }
    close() {
        this.closed = true;
    }
    open() {
        this.onopen?.();
    }
    receive(message: ServerMessage) {
        this.onmessage?.({ data: JSON.stringify(message) });
    }
    drop(code = 1006) {
        this.onclose?.({ code });
    }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe('openListSocket', () => {
    const getTicket = vi.fn();
    const onChanged = vi.fn();
    const onPresence = vi.fn();
    let close: () => void;

    const open = () => {
        close = openListSocket({
            listTitle: 'My List',
            getTicket,
            onChanged,
            onPresence,
            createSocket: (url) => fake<WebSocket>(new FakeSocket(url)),
            random: () => 1,
        });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        FakeSocket.instances = [];
        getTicket.mockReset().mockResolvedValue('t1');
        onChanged.mockReset();
        onPresence.mockReset();
    });

    afterEach(() => {
        close?.();
        vi.useRealTimers();
    });

    it('connects with the ticket for the list and refetches once the socket opens', async () => {
        open();
        await flush();

        expect(FakeSocket.instances[0].url).toMatch(/^ws:\/\/.+\/api\/ws\/lists\/My%20List\?ticket=t1$/);
        expect(onChanged).not.toHaveBeenCalled();

        FakeSocket.instances[0].open();
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('turns server messages into a refetch and a presence update', async () => {
        open();
        await flush();
        const socket = FakeSocket.instances[0];
        socket.open();
        onChanged.mockClear();

        socket.receive({ type: 'changed' });
        socket.receive({ type: 'presence', users: [{ id: 'b', username: 'bob' }] });
        socket.onmessage?.({ data: 'not json' });

        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(onPresence).toHaveBeenLastCalledWith([{ id: 'b', username: 'bob' }]);
    });

    it('reconnects with a fresh ticket and refetches what it missed, backing off while it keeps failing', async () => {
        open();
        await flush();
        FakeSocket.instances[0].open();
        onChanged.mockClear();
        getTicket.mockResolvedValue('t2');

        FakeSocket.instances[0].drop();
        expect(onPresence).toHaveBeenLastCalledWith([]);
        await vi.advanceTimersByTimeAsync(999);
        expect(FakeSocket.instances).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(FakeSocket.instances).toHaveLength(2);
        expect(FakeSocket.instances[1].url).toContain('ticket=t2');

        FakeSocket.instances[1].open();
        expect(onChanged).toHaveBeenCalledTimes(1);

        // A second drop before it ever opened again doubles the wait.
        FakeSocket.instances[1].drop();
        await vi.advanceTimersByTimeAsync(1000);
        FakeSocket.instances[2]?.drop();
        await vi.advanceTimersByTimeAsync(1999);
        expect(FakeSocket.instances).toHaveLength(3);
        await vi.advanceTimersByTimeAsync(1);
        expect(FakeSocket.instances).toHaveLength(4);
    });

    it('keeps retrying when the ticket request fails, but gives up when the user is not a member', async () => {
        getTicket.mockRejectedValueOnce(new Error('network down')).mockResolvedValue('t1');
        open();
        await flush();
        expect(FakeSocket.instances).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1000);
        expect(FakeSocket.instances).toHaveLength(1);
        close();

        getTicket.mockReset().mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
        FakeSocket.instances = [];
        open();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(FakeSocket.instances).toHaveLength(0);
        expect(getTicket).toHaveBeenCalledTimes(1);
    });

    it('does not reconnect after the server removed the user from the list', async () => {
        open();
        await flush();
        FakeSocket.instances[0].drop(4403);
        await vi.advanceTimersByTimeAsync(60_000);

        expect(FakeSocket.instances).toHaveLength(1);
    });

    it('reconnects immediately when the browser comes back online', async () => {
        open();
        await flush();
        FakeSocket.instances[0].drop();

        window.dispatchEvent(new Event('online'));
        await flush();

        expect(FakeSocket.instances).toHaveLength(2);
    });

    it('closes the socket and stops retrying once disposed', async () => {
        open();
        await flush();
        const socket = FakeSocket.instances[0];
        socket.drop();
        close();
        await vi.advanceTimersByTimeAsync(60_000);

        expect(FakeSocket.instances).toHaveLength(1);

        open();
        await flush();
        const second = FakeSocket.instances[1];
        close();
        expect(second.closed).toBe(true);
    });
});
