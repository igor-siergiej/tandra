import { APIError } from '@imapps/api-utils/hono';
import type { ItemCategory } from '@tandra/types';
import type { Context } from 'hono';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import { logErrorFields } from '../../domain/logError';
import type { HonoVars } from '../handlerUtils';

// A user picking an aisle for an item. Always wins over the background classifier, which only fills unset values.
// Access check, validation and service call in one linear flow; splitting further would scatter one request.
// fallow-ignore-next-line complexity
export const setItemCategory = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const itemId = c.req.param('itemId');
    const { category } = await c.req.json<{ category?: ItemCategory }>();
    const user = c.get('user');
    const listService = dependencyContainer.resolve(DependencyToken.ListService);
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    let listId: string | undefined;

    try {
        const list = await listService.getList(title);

        listId = list.id;

        if (!list.users?.some((member: { id: string }) => member.id === user?.id)) {
            logger.warn('Unauthorized item category change', { authenticatedUserId: user?.id, listId });

            return c.json({ error: 'Forbidden' }, 403);
        }

        const result = await listService.setItemCategory(title, itemId, category);

        logger.info('API: Item category set', { listId, itemId, category });

        return c.json(result, 200);
    } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        logger.error('API: Failed to set item category', { listId, itemId, ...logErrorFields(error) });
        throw new APIError(err.message ?? 'Internal Server Error', err.status ?? 500);
    }
};
