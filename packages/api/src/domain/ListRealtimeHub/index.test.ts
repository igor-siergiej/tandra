import { describe, expect, it } from 'bun:test';

import { ListRealtimeHub, type ListSocket } from './index';

const socket = (sent: string[] = []): ListSocket & { sent: string[] } => ({
    sent,
    send: (data: string) => sent.push(data),
    close: () => undefined,
});

const ALICE = { id: 'a', username: 'alice' };
const BOB = { id: 'b', username: 'bob' };

describe('ListRealtimeHub', () => {
    it('lists a user once even when they have the list open on two devices', () => {
        const hub = new ListRealtimeHub();
        hub.join('L', ALICE, socket());
        hub.join('L', ALICE, socket());
        hub.join('L', BOB, socket());

        expect(hub.presence('L').map((u) => u.id)).toEqual(['a', 'b']);
    });

    it('keeps a user present until their last connection closes', () => {
        const hub = new ListRealtimeHub();
        const phone = socket();
        const laptop = socket();
        hub.join('L', ALICE, phone);
        hub.join('L', ALICE, laptop);

        hub.leave('L', phone);
        expect(hub.presence('L')).toEqual([ALICE]);

        hub.leave('L', laptop);
        expect(hub.presence('L')).toEqual([]);
    });

    it('keeps delivering to healthy sockets when one send throws', () => {
        const hub = new ListRealtimeHub();

        const broken = {
            send: () => {
                throw new Error('closed');
            },
            close: () => undefined,
        };

        const healthy = socket();
        hub.join('L', ALICE, broken);
        hub.join('L', BOB, healthy);
        healthy.sent.length = 0;

        hub.notifyChanged('L');

        expect(healthy.sent).toEqual([JSON.stringify({ type: 'changed' })]);
    });
});
