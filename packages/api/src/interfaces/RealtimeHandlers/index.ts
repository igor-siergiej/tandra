import type { Context, Next } from 'hono';

import type { ListRealtimeHub, ListSocket } from '../../domain/ListRealtimeHub';
import type { WsTicketStore } from '../../domain/WsTicketStore';
import { upgradeWebSocket } from '../../infrastructure/bunWebSocket';
import { type AuthUser, type HonoVars, withAuth } from '../handlerUtils';

type WsVars = { Variables: { wsUser: AuthUser; wsListId: string } };

interface RealtimeDeps {
    hub: ListRealtimeHub;
    tickets: WsTicketStore;
    getList: (listRef: string) => Promise<{ id: string; users?: Array<{ id: string }> }>;
}

export const createRealtimeHandlers = ({ hub, tickets, getList }: RealtimeDeps) => {
    /** The list's id when the user is a member, else null. Rooms and tickets are keyed by id however the list was referenced. */
    const memberListId = async (listRef: string, user: AuthUser): Promise<string | null> => {
        try {
            const list = await getList(listRef);

            return list.users?.some((member) => member.id === user.id) ? list.id : null;
        } catch {
            return null;
        }
    };

    /** POST /api/lists/:title/socket-ticket — authenticated, list members only. */
    const issueListSocketTicket = withAuth(async (c, user) => {
        const listId = await memberListId(c.req.param('title') ?? '', user);

        if (!listId) return c.json({ error: 'Forbidden' }, 403);

        return c.json({ ticket: tickets.issue(listId, user) });
    });

    const upgrade = upgradeWebSocket((c: Context<WsVars>) => {
        const listId = c.get('wsListId');
        const user = c.get('wsUser');

        return {
            onOpen: (_event, ws) => hub.join(listId, user, ws.raw as ListSocket),
            onClose: (_event, ws) => hub.leave(listId, ws.raw as ListSocket),
        };
    });

    /**
     * GET /api/ws/lists/:title?ticket=… — upgrades to a websocket only when the ticket is valid
     * for this list and its user is (still) a member. Anything else is rejected before the upgrade.
     */
    // Ref resolution, ticket redemption and membership check run in order before the upgrade.
    // fallow-ignore-next-line complexity
    const connectListSocket = async (c: Context<HonoVars & WsVars>, next: Next) => {
        const listRef = c.req.param('title') ?? '';
        let listId: string | null = null;

        try {
            listId = (await getList(listRef)).id;
        } catch {
            listId = null;
        }

        const user = listId ? tickets.redeem(c.req.query('ticket'), listId) : null;

        if (!listId || !user || !(await memberListId(listId, user))) {
            return c.json({ error: 'Invalid or expired ticket' }, 401);
        }

        c.set('wsUser', user);
        c.set('wsListId', listId);

        return upgrade(c as unknown as Context<WsVars>, next);
    };

    return { issueListSocketTicket, connectListSocket };
};
