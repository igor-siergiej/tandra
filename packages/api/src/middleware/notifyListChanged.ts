import type { Context, Next } from 'hono';

import type { ListRealtimeHub } from '../domain/ListRealtimeHub';

/**
 * Wrap a successful `/api/lists/:title/...` mutation: once the handler has answered with a
 * non-error status, tell everyone with that list open that it changed. The route parameter is a
 * list reference (its id, or a legacy title), so it is resolved to the list id up front, while
 * the list still exists, because the hub's rooms are keyed by id. `onSuccess` runs first so a
 * route can also react (e.g. drop a removed member's sockets).
 */
export const notifyListChanged =
    (
        hub: ListRealtimeHub,
        resolveListId: (listRef: string) => Promise<string | undefined>,
        onSuccess?: (c: Context, listId: string) => void
    ) =>
    // fallow-ignore-next-line complexity
    async (c: Context, next: Next): Promise<void> => {
        const listRef = c.req.param('title');
        const listId = listRef ? await resolveListId(listRef) : undefined;
        await next();

        if (c.res.status >= 400 || !listId) return;
        onSuccess?.(c, listId);
        hub.notifyChanged(listId);
    };
