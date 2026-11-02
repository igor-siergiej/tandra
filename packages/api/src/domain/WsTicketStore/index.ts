export interface TicketUser {
    id: string;
    username: string;
}

interface Ticket {
    listTitle: string;
    user: TicketUser;
    expiresAt: number;
}

const TICKET_TTL_MS = 30_000;

/**
 * Short-lived, single-use tickets that let a browser open a list websocket. Browsers cannot
 * set an Authorization header on `new WebSocket(...)`, and putting the long-lived access token
 * in the URL would leak it into proxy/access logs. A ticket is bound to one list and one user,
 * is useless after one redemption or `TICKET_TTL_MS`, and is only ever held in memory.
 */
export class WsTicketStore {
    private readonly tickets = new Map<string, Ticket>();

    constructor(private readonly now: () => number = Date.now) {}

    issue(listTitle: string, user: TicketUser): string {
        this.purgeExpired();
        const ticket = crypto.randomUUID();
        this.tickets.set(ticket, { listTitle, user, expiresAt: this.now() + TICKET_TTL_MS });

        return ticket;
    }

    /** Returns the ticket's user if it is valid for this list; always consumes the ticket. */
    redeem(ticket: string | undefined, listTitle: string): TicketUser | null {
        const entry = this.take(ticket);

        return entry && entry.expiresAt > this.now() && entry.listTitle === listTitle ? entry.user : null;
    }

    private take(ticket: string | undefined): Ticket | undefined {
        const entry = ticket ? this.tickets.get(ticket) : undefined;

        if (ticket) this.tickets.delete(ticket);

        return entry;
    }

    private purgeExpired(): void {
        const now = this.now();

        for (const [ticket, entry] of this.tickets) {
            if (entry.expiresAt <= now) this.tickets.delete(ticket);
        }
    }
}
