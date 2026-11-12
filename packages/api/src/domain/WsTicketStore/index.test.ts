import { describe, expect, it } from 'bun:test';

import { WsTicketStore } from './index';

const TICKET_TTL_MS = 30_000;

const USER = { id: 'u1', username: 'alice' };

describe('WsTicketStore', () => {
    it('redeems a ticket once, for the list it was issued for', () => {
        const store = new WsTicketStore();
        const ticket = store.issue('Groceries', USER);

        expect(store.redeem(ticket, 'Groceries')).toEqual(USER);
        expect(store.redeem(ticket, 'Groceries')).toBeNull();
    });

    it('rejects an expired ticket', () => {
        let now = 1_000;
        const store = new WsTicketStore(() => now);
        const ticket = store.issue('Groceries', USER);

        now += TICKET_TTL_MS;

        expect(store.redeem(ticket, 'Groceries')).toBeNull();
    });

    it('rejects unknown and missing tickets', () => {
        const store = new WsTicketStore();

        expect(store.redeem('nope', 'Groceries')).toBeNull();
        expect(store.redeem(undefined, 'Groceries')).toBeNull();
    });
});
