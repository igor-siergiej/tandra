import { APIError } from '@imapps/api-utils/hono';
import type { ListType } from '@tandra/types';
import type { Context } from 'hono';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import type { AuthorizationService } from '../../domain/AuthorizationService';
import type { ListService } from '../../domain/ListService';
import type { HonoVars } from '../handlerUtils';

interface HttpError {
    status?: number;
    [key: string]: unknown;
}

const getListService = (): ListService => dependencyContainer.resolve(DependencyToken.ListService);
const getLogger = () => dependencyContainer.resolve(DependencyToken.Logger);
const getAuthorizationService = (): AuthorizationService =>
    dependencyContainer.resolve(DependencyToken.AuthorizationService);

const verifyListAccess = async (
    title: string,
    authenticatedUser: { id: string; username: string }
): Promise<boolean> => {
    try {
        const list = await getListService().getList(title);
        return list.users?.some((u: { id: string; username: string }) => u.id === authenticatedUser.id) || false;
    } catch {
        return false;
    }
};

const resolveItemOperation = (body: {
    isSelected?: boolean;
    newItemName?: string;
    quantity?: number;
    unit?: string;
}): {
    type: 'name' | 'selection' | 'quantity';
    execute: (service: ReturnType<typeof getListService>, title: string, itemId: string) => Promise<unknown>;
} | null => {
    if (body.newItemName !== undefined) {
        return {
            type: 'name',
            execute: (service, title, itemId) => service.updateItemName(title, itemId, body.newItemName),
        };
    }

    if (typeof body.isSelected === 'boolean') {
        return {
            type: 'selection',
            execute: (service, title, itemId) => service.setItemSelected(title, itemId, body.isSelected),
        };
    }

    if (body.quantity !== undefined || body.unit !== undefined) {
        return {
            type: 'quantity',
            execute: (service, title, itemId) => service.updateItemQuantity(title, itemId, body.quantity, body.unit),
        };
    }

    return null;
};

const ensureListAccess = async (
    c: Context<HonoVars>,
    title: string,
    authenticatedUser: { id: string; username: string },
    logger: ReturnType<typeof getLogger>
): Promise<Response | null> => {
    const hasAccess = await verifyListAccess(title, authenticatedUser);
    if (!hasAccess) {
        logger.warn('Unauthorized list access attempt', {
            authenticatedUserId: authenticatedUser.id,
            listTitle: title,
        });
        return c.json({ error: 'Forbidden' }, 403);
    }
    return null;
};

const failWith = (
    error: unknown,
    logger: ReturnType<typeof getLogger>,
    message: string,
    meta: Record<string, unknown>
): never => {
    const err = error as { status?: number; message?: string };
    logger.error(message, { ...meta, error: err.message });
    throw new APIError(err.message ?? 'Internal Server Error', err.status ?? 500);
};

export const getList = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const list = await getListService().getList(title);
        const effectiveOwnerId = getAuthorizationService().getEffectiveOwnerId(list);

        logger.info('API: List retrieved', {
            listTitle: title,
            itemCount: list.items.length,
            listType: list.listType,
        });

        c.header('Cache-Control', 'no-store');
        return c.json(
            {
                listType: list.listType,
                items: list.items,
                users: list.users.map((u) => ({ id: u.id, username: u.username })),
                ownerId: effectiveOwnerId,
            },
            200
        );
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to retrieve list items', { listTitle: title });
    }
};

export const getLists = async (c: Context<HonoVars>) => {
    const userId = c.req.param('userId');
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    if (userId !== authenticatedUser.id) {
        logger.warn('Unauthorized list access attempt', {
            authenticatedUserId: authenticatedUser.id,
            requestedUserId: userId,
        });
        return c.json({ error: 'Forbidden' }, 403);
    }

    try {
        const lists = await getListService().getListsForUser(userId);
        logger.info('User accessed their lists', { userId, listCount: lists.length });
        return c.json(lists, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'Failed to get lists for user', { userId });
    }
};

export const addList = async (c: Context<HonoVars>) => {
    const { title, dateAdded, selectedUsers, listType, id } = await c.req.json<{
        title: string;
        dateAdded: Date;
        selectedUsers?: Array<string>;
        listType?: ListType;
        id?: string;
    }>();
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const list = await getListService().addList(title, dateAdded, authenticatedUser, selectedUsers, listType, id);

        logger.info('API: List created', {
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            listId: list.id,
            listTitle: title,
            listType: list.listType,
        });

        return c.json(list, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to create list', {
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            listTitle: title,
        });
    }
};

export const addItem = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const { itemName, dateAdded, quantity, unit, id } = await c.req.json<{
        itemName: string;
        dateAdded: Date;
        quantity?: number;
        unit?: string;
        id?: string;
    }>();
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const item = await getListService().addItem(title, itemName, dateAdded, quantity, unit, authenticatedUser, id);

        logger.info('API: Item added to list', {
            listTitle: title,
            itemName,
            itemId: item.id,
            quantity,
            unit,
        });

        return c.json(item, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to add item to list', { listTitle: title, itemName });
    }
};

export const updateItem = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const itemId = c.req.param('itemId');
    const requestBody = await c.req.json<{
        isSelected?: boolean;
        newItemName?: string;
        quantity?: number;
        unit?: string;
    }>();
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const operation = resolveItemOperation(requestBody);
        if (!operation) {
            logger.warn('API: Invalid item update request', {
                listTitle: title,
                itemId,
                providedFields: requestBody,
            });
            return c.json(
                { error: 'Either isSelected (boolean), newItemName (string), or quantity/unit must be provided' },
                400
            );
        }

        const result = await operation.execute(getListService(), title, itemId);
        logger.info(`API: Item ${operation.type} updated`, {
            listTitle: title,
            itemId,
            ...requestBody,
        });
        return c.json(result, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to update item', { listTitle: title, itemId });
    }
};

export const deleteItem = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const itemId = c.req.param('itemId');
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const list = await getListService().deleteItem(title, itemId);

        logger.info('API: Item deleted from list', {
            listTitle: title,
            itemId,
            remainingItemCount: list.items.length,
        });

        return c.json(list, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to delete item', { listTitle: title, itemId });
    }
};

export const deleteList = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const list = await getListService().getList(title);

        if (!getAuthorizationService().isListOwner(list, authenticatedUser.id)) {
            logger.warn('Non-owner attempted to delete list', {
                authenticatedUserId: authenticatedUser.id,
                listTitle: title,
            });
            return c.json({ error: 'Only the list owner can delete this list' }, 403);
        }

        const result = await getListService().deleteList(title);

        logger.info('API: List deleted', { listTitle: title });

        return c.json(result, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to delete list', { listTitle: title });
    }
};

export const updateList = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const { newTitle } = await c.req.json<{ newTitle?: string }>();
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const result = await getListService().updateListTitle(title, newTitle);

        logger.info('API: List title updated', { oldTitle: title, newTitle });

        return c.json(result, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to update list title', { oldTitle: title, newTitle });
    }
};

export const clearList = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const list = await getListService().clearList(title);

        logger.info('API: List cleared', {
            listTitle: title,
            clearedItemCount: list.items.length,
        });

        return c.json(list, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to clear list', { listTitle: title });
    }
};

export const deleteSelected = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    try {
        const denied = await ensureListAccess(c, title, authenticatedUser, logger);
        if (denied) return denied;

        const list = await getListService().clearSelectedItems(title);

        logger.info('API: Selected items cleared from list', {
            listTitle: title,
            remainingItemCount: list.items.length,
        });

        return c.json(list, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to clear selected items', { listTitle: title });
    }
};

export const addUserToList = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const { friendId } = await c.req.json<{ friendId: string }>();
    const authenticatedUser = c.get('user');
    const logger = getLogger();

    const denied = await ensureListAccess(c, title, authenticatedUser, logger);
    if (denied) return denied;

    try {
        const list = await getListService().addUserToList(title, friendId.trim(), authenticatedUser.id);

        logger.info('API: User added to list', {
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            listTitle: title,
            addedUser: friendId,
        });

        return c.json(list, 200);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        const status = (error as HttpError)?.status ?? 500;
        const errorMessage = err.message || 'Internal Server Error';

        logger.error('API: Failed to add user to list', {
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            listTitle: title,
            addedUser: friendId,
            error: errorMessage,
            status,
        });

        throw new APIError(errorMessage, status);
    }
};

export const removeUserFromList = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const userId = c.req.param('userId');
    const authenticatedUser = c.get('user');
    const logger = getLogger();

    const denied = await ensureListAccess(c, title, authenticatedUser, logger);
    if (denied) return denied;

    try {
        const list = await getListService().removeUserFromList(title, userId, authenticatedUser.id);

        logger.info('API: User removed from list', {
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            listTitle: title,
            removedUserId: userId,
        });

        return c.json(list, 200);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        const status = (error as HttpError)?.status ?? 500;
        const errorMessage = err.message || 'Internal Server Error';

        logger.error('API: Failed to remove user from list', {
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            listTitle: title,
            removedUserId: userId,
            error: errorMessage,
            status,
        });

        throw new APIError(errorMessage, status);
    }
};

export const addItems = async (c: Context<HonoVars>) => {
    const title = c.req.param('title');
    const { items } = await c.req.json<{
        items: Array<{ itemName: string; quantity?: number; unit?: string; dateAdded: Date }>;
    }>();
    const logger = getLogger();
    const authenticatedUser = c.get('user');

    const denied = await ensureListAccess(c, title, authenticatedUser, logger);
    if (denied) return denied;

    try {
        const result = await getListService().addItems(title, items, authenticatedUser.id, authenticatedUser);

        logger.info('API: Items bulk added to list', {
            listTitle: title,
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
            addedCount: result.added,
            skippedCount: result.skipped,
        });

        return c.json(result, 200);
    } catch (error: unknown) {
        return failWith(error, logger, 'API: Failed to add items to list', {
            listTitle: title,
            userId: authenticatedUser.id,
            username: authenticatedUser.username,
        });
    }
};
