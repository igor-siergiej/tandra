import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { type Item, type List, ListType } from '@tandra/types';

import * as listHandlers from './index';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies', () => ({
    dependencyContainer: mockDependencyContainer,
}));

const mockListService = {
    getList: vi.fn(),
    getListItems: vi.fn(),
    getListsForUser: vi.fn(),
    addList: vi.fn(),
    updateItemName: vi.fn(),
    setItemSelected: vi.fn(),
    clearSelectedItems: vi.fn(),
    deleteItem: vi.fn(),
    updateListTitle: vi.fn(),
    deleteList: vi.fn(),
    clearList: vi.fn(),
    addItem: vi.fn(),
    updateItemQuantity: vi.fn(),
    addUserToList: vi.fn(),
    removeUserFromList: vi.fn(),
    addItems: vi.fn(),
};

const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
};

const mockAuthorizationService = {
    isListOwner: vi.fn().mockReturnValue(true),
    canManageUsers: vi.fn().mockReturnValue(true),
    getEffectiveOwnerId: vi.fn().mockReturnValue('test-user-1'),
};

type HonoVars = { Variables: { user: { id: string; username: string } } };

const createMockContext = (
    overrides: { params?: Record<string, string>; body?: unknown; user?: { id: string; username: string } } = {}
) => {
    const vars: Record<string, unknown> = {
        user: overrides.user ?? { id: 'test-user-1', username: 'testuser' },
    };

    const ctx = {
        req: {
            param: (name: string) => overrides.params?.[name],
            json: vi.fn().mockResolvedValue(overrides.body ?? {}),
            header: (_name: string): undefined => undefined,
        },
        header: vi.fn(),
        json: vi.fn().mockImplementation((body: unknown, status: number): Response => {
            const r = new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' },
            });

            return r;
        }),
        get: (key: string) => vars[key],
        set: (key: string, val: unknown) => {
            vars[key] = val;
        },
    } as unknown as import('hono').Context<HonoVars>;

    return ctx;
};

const getResponseBody = async (response: Response) => response.json();

describe('ListHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockImplementation((token: string) => {
            if (token === 'ListService') return mockListService;

            if (token === 'Logger') return mockLogger;

            if (token === 'AuthorizationService') return mockAuthorizationService;

            return null;
        });

        mockListService.getList.mockResolvedValue({
            id: 'list-1',
            title: 'Test List',
            dateAdded: new Date(),
            items: [],
            users: [{ id: 'test-user-1', username: 'testuser' }],
            listType: ListType.SHOPPING,
        });
    });

    describe('getList', () => {
        it('should return list items successfully', async () => {
            const mockItems: Array<Item> = [
                {
                    id: 'item-1',
                    name: 'Item 1',
                    dateAdded: new Date(),
                    isSelected: false,
                },
            ];

            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: mockItems,
                users: [{ id: 'test-user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.getList(ctx);

            expect(mockListService.getList).toHaveBeenCalledWith('Test List');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.listType).toBe(ListType.SHOPPING);
            expect(body.ownerId).toBe('test-user-1');
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList
                .mockResolvedValueOnce({
                    id: 'list-1',
                    title: 'Test List',
                    dateAdded: new Date(),
                    items: [],
                    users: [{ id: 'test-user-1', username: 'testuser' }],
                    listType: ListType.SHOPPING,
                })
                .mockRejectedValueOnce(Object.assign(new Error('List not found'), { status: 404 }));

            await expect(listHandlers.getList(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('getLists', () => {
        it('should return user lists successfully', async () => {
            const mockLists: Array<List> = [
                {
                    id: 'list-1',
                    title: 'Test List',
                    dateAdded: new Date(),
                    items: [],
                    users: [{ id: 'test-user-1', username: 'testuser' }],
                    listType: ListType.SHOPPING,
                },
            ];

            const ctx = createMockContext({ params: { userId: 'test-user-1' } });

            mockListService.getListsForUser.mockResolvedValue(mockLists);

            const response = await listHandlers.getLists(ctx);

            expect(mockListService.getListsForUser).toHaveBeenCalledWith('test-user-1');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body).toHaveLength(1);
            expect(body[0].id).toBe('list-1');
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({ params: { userId: 'test-user-1' } });

            mockListService.getListsForUser.mockRejectedValue(new Error('userId is required'));

            await expect(listHandlers.getLists(ctx)).rejects.toThrow('userId is required');
        });

        it('should deny access if userId does not match authenticated user', async () => {
            const ctx = createMockContext({ params: { userId: 'different-user-id' } });

            const response = await listHandlers.getLists(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });
    });

    describe('addList', () => {
        it('should add list successfully', async () => {
            const mockList: List = {
                id: 'list-1',
                title: 'New List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'test-user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({
                body: {
                    title: 'New List',
                    dateAdded: new Date().toISOString(),
                    selectedUsers: [],
                    listType: ListType.SHOPPING,
                },
            });

            mockListService.addList.mockResolvedValue(mockList);

            const response = await listHandlers.addList(ctx);

            expect(mockListService.addList).toHaveBeenCalledWith(
                'New List',
                expect.any(String),
                { id: 'test-user-1', username: 'testuser' },
                [],
                'shopping',
                undefined
            );
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.id).toBe(mockList.id);
        });

        it('should thread a caller-provided id through to the service', async () => {
            const mockList: List = {
                id: 'client-list-uuid',
                title: 'New List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'test-user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({
                body: {
                    title: 'New List',
                    dateAdded: new Date().toISOString(),
                    selectedUsers: [],
                    listType: ListType.SHOPPING,
                    id: 'client-list-uuid',
                },
            });

            mockListService.addList.mockResolvedValue(mockList);

            await listHandlers.addList(ctx);

            expect(mockListService.addList).toHaveBeenCalledWith(
                'New List',
                expect.any(String),
                { id: 'test-user-1', username: 'testuser' },
                [],
                'shopping',
                'client-list-uuid'
            );
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                body: {
                    title: 'New List',
                    dateAdded: new Date().toISOString(),
                },
            });

            mockListService.addList.mockRejectedValue(new Error('Auth service not configured'));

            await expect(listHandlers.addList(ctx)).rejects.toThrow('Auth service not configured');
        });
    });

    describe('updateItem', () => {
        it('should update item successfully', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { newItemName: 'New Name' },
            });

            mockListService.updateItemName.mockResolvedValue({
                message: 'Item updated successfully',
                newItemName: 'New Name',
            });

            const response = await listHandlers.updateItem(ctx);

            expect(mockListService.updateItemName).toHaveBeenCalledWith('Test List', 'item-1', 'New Name');
            expect(response.status).toBe(200);
            expect(await getResponseBody(response)).toEqual({
                message: 'Item updated successfully',
                newItemName: 'New Name',
            });
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { newItemName: 'New Name' },
            });

            mockListService.updateItemName.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.updateItem(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('deleteItem', () => {
        it('should delete item successfully', async () => {
            const mockList: List = {
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
            });

            mockListService.deleteItem.mockResolvedValue(mockList);

            const response = await listHandlers.deleteItem(ctx);

            expect(mockListService.deleteItem).toHaveBeenCalledWith('Test List', 'item-1');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.id).toBe(mockList.id);
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
            });

            mockListService.deleteItem.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.deleteItem(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('clearList', () => {
        it('should clear list successfully', async () => {
            const mockList: List = {
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.clearList.mockResolvedValue(mockList);

            const response = await listHandlers.clearList(ctx);

            expect(mockListService.clearList).toHaveBeenCalledWith('Test List');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.id).toBe(mockList.id);
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.clearList.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.clearList(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('deleteSelected', () => {
        it('should delete selected items successfully', async () => {
            const mockList: List = {
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.clearSelectedItems.mockResolvedValue(mockList);

            const response = await listHandlers.deleteSelected(ctx);

            expect(mockListService.clearSelectedItems).toHaveBeenCalledWith('Test List');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.id).toBe(mockList.id);
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.clearSelectedItems.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.deleteSelected(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('updateList', () => {
        it('should update list successfully', async () => {
            const ctx = createMockContext({
                params: { title: 'Old Title' },
                body: { newTitle: 'New Title' },
            });

            mockListService.updateListTitle.mockResolvedValue({
                message: 'List updated successfully',
                newTitle: 'New Title',
            });

            const response = await listHandlers.updateList(ctx);

            expect(mockListService.updateListTitle).toHaveBeenCalledWith('Old Title', 'New Title');
            expect(response.status).toBe(200);
            expect(await getResponseBody(response)).toEqual({
                message: 'List updated successfully',
                newTitle: 'New Title',
            });
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                params: { title: 'Old Title' },
                body: { newTitle: 'New Title' },
            });

            mockListService.updateListTitle.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.updateList(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('addItem', () => {
        it('should add item successfully', async () => {
            const mockItem: Item = {
                id: 'item-1',
                name: 'New Item',
                dateAdded: new Date(),
                isSelected: false,
            };

            const ctx = createMockContext({
                params: { title: 'Test List' },
                body: { itemName: 'New Item', dateAdded: new Date().toISOString() },
            });

            mockListService.addItem.mockResolvedValue(mockItem);

            const response = await listHandlers.addItem(ctx);

            expect(mockListService.addItem).toHaveBeenCalledWith(
                'Test List',
                'New Item',
                expect.any(String),
                undefined,
                undefined,
                { id: 'test-user-1', username: 'testuser' },
                undefined
            );
            expect(response.status).toBe(200);
            expect(await getResponseBody(response)).toEqual({
                ...mockItem,
                dateAdded: mockItem.dateAdded.toISOString(),
            });
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List' },
                body: { itemName: 'New Item', dateAdded: new Date().toISOString() },
            });

            mockListService.addItem.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.addItem(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('deleteList', () => {
        it('should delete list successfully', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.deleteList.mockResolvedValue({
                message: 'List deleted successfully',
            });

            const response = await listHandlers.deleteList(ctx);

            expect(mockListService.deleteList).toHaveBeenCalledWith('Test List');
            expect(response.status).toBe(200);
            expect(await getResponseBody(response)).toEqual({
                message: 'List deleted successfully',
            });
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.deleteList.mockRejectedValue(new Error('List not found'));

            await expect(listHandlers.deleteList(ctx)).rejects.toThrow('List not found');
        });
    });

    describe('addUserToList', () => {
        it('should add user successfully', async () => {
            const mockList: List = {
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'test-user-1', username: 'testuser' },
                    { id: 'user-2', username: 'newuser' },
                ],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({
                params: { title: 'Test List' },
                body: { friendId: 'user-2' },
            });

            mockListService.addUserToList.mockResolvedValue(mockList);

            const response = await listHandlers.addUserToList(ctx);

            expect(mockListService.addUserToList).toHaveBeenCalledWith('Test List', 'user-2', 'test-user-1');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.id).toBe(mockList.id);
        });

        it('should return 403 when user has no list access', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List' },
                body: { friendId: 'user-2' },
            });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.addUserToList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List' },
                body: { friendId: 'user-2' },
            });

            mockListService.addUserToList.mockRejectedValue(
                Object.assign(new Error('Only the list owner can manage users'), { status: 403 })
            );

            await expect(listHandlers.addUserToList(ctx)).rejects.toThrow('Only the list owner can manage users');
        });
    });

    describe('removeUserFromList', () => {
        it('should remove user successfully', async () => {
            const mockList: List = {
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'test-user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
            };

            const ctx = createMockContext({
                params: { title: 'Test List', userId: 'user-2' },
            });

            mockListService.removeUserFromList.mockResolvedValue(mockList);

            const response = await listHandlers.removeUserFromList(ctx);

            expect(mockListService.removeUserFromList).toHaveBeenCalledWith('Test List', 'user-2', 'test-user-1');
            expect(response.status).toBe(200);
            const body = await getResponseBody(response);
            expect(body.id).toBe(mockList.id);
        });

        it('should return 403 when user has no list access', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', userId: 'user-2' },
            });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.removeUserFromList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('should handle service errors', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', userId: 'user-2' },
            });

            mockListService.removeUserFromList.mockRejectedValue(
                Object.assign(new Error('Cannot remove the list owner'), { status: 400 })
            );

            await expect(listHandlers.removeUserFromList(ctx)).rejects.toThrow('Cannot remove the list owner');
        });
    });

    describe('Missing Coverage - 403 Unauthorized Access', () => {
        it('getList should return 403 when user not in list', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.getList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('addItem should return 403 when user not in list', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List' },
                body: { itemName: 'New Item', dateAdded: new Date().toISOString() },
            });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.addItem(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('updateItem should return 403 when user not in list', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { newItemName: 'Updated Item' },
            });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.updateItem(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('deleteItem should return 403 when user not in list', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
            });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.deleteItem(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('deleteList should return 403 when user not in list', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.deleteList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('deleteList should return 403 when user not owner', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'test-user-1', username: 'testuser' }],
                listType: ListType.SHOPPING,
                ownerId: 'other-owner',
            });

            mockAuthorizationService.isListOwner.mockReturnValue(false);

            const response = await listHandlers.deleteList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Only the list owner can delete this list' });
        });

        it('updateList should return 403 when user not in list', async () => {
            const ctx = createMockContext({
                params: { title: 'Old List' },
                body: { newTitle: 'New List' },
            });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Old List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.updateList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('clearList should return 403 when user not in list', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.clearList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });

        it('deleteSelected should return 403 when user not in list', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockResolvedValue({
                id: 'list-1',
                title: 'Test List',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'other-user', username: 'other' }],
                listType: ListType.SHOPPING,
            });

            const response = await listHandlers.deleteSelected(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });
    });

    describe('Missing Coverage - verifyListAccess catch block', () => {
        it('should return 403 when getList throws error in verifyListAccess', async () => {
            const ctx = createMockContext({ params: { title: 'Test List' } });

            mockListService.getList.mockRejectedValue(new Error('Database error'));

            const response = await listHandlers.getList(ctx);

            expect(response.status).toBe(403);
            expect(await getResponseBody(response)).toEqual({ error: 'Forbidden' });
        });
    });

    describe('Missing Coverage - updateItem branches', () => {
        it('should update item selection successfully', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { isSelected: true },
            });

            mockListService.setItemSelected.mockResolvedValue({
                message: 'Item selection updated',
            });

            const response = await listHandlers.updateItem(ctx);

            expect(mockListService.setItemSelected).toHaveBeenCalledWith('Test List', 'item-1', true);
            expect(response.status).toBe(200);
            expect(await getResponseBody(response)).toEqual({ message: 'Item selection updated' });
        });

        it('should update item quantity successfully', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { quantity: 5, unit: 'kg' },
            });

            mockListService.updateItemQuantity.mockResolvedValue({
                message: 'Item quantity updated',
            });

            const response = await listHandlers.updateItem(ctx);

            expect(mockListService.updateItemQuantity).toHaveBeenCalledWith('Test List', 'item-1', 5, 'kg');
            expect(response.status).toBe(200);
            expect(await getResponseBody(response)).toEqual({ message: 'Item quantity updated' });
        });

        it('should return 400 when no valid update fields provided', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: {},
            });

            const response = await listHandlers.updateItem(ctx);

            expect(response.status).toBe(400);
            const body = await getResponseBody(response);
            expect(body.error).toBeDefined();
        });

        it('should handle error in setItemSelected', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { isSelected: true },
            });

            mockListService.setItemSelected.mockRejectedValue(new Error('Update failed'));

            await expect(listHandlers.updateItem(ctx)).rejects.toThrow('Update failed');
        });

        it('should handle error in updateItemQuantity', async () => {
            const ctx = createMockContext({
                params: { title: 'Test List', itemId: 'item-1' },
                body: { quantity: 5 },
            });

            mockListService.updateItemQuantity.mockRejectedValue(new Error('Quantity update failed'));

            await expect(listHandlers.updateItem(ctx)).rejects.toThrow('Quantity update failed');
        });
    });
});
