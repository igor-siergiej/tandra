import { beforeEach, describe, expect, it, vi } from 'bun:test';

import { ListType } from '@tandra/types';
import type { Context } from 'hono';

import { setItemCategory } from './category';
import * as listHandlers from './index';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies', () => ({
    dependencyContainer: mockDependencyContainer,
}));

// The privacy notice promises logs hold no list-item text: list titles and item names must never reach a log line,
// whether they arrive in the URL, the request body or a service result.
const LIST_TITLE = 'quokkafest-list-title';
const NEW_LIST_TITLE = 'quokkafest-renamed-title';
const ITEM_NAME = 'dragonfruit-item-name';
const NEW_ITEM_NAME = 'dragonfruit-new-item';
const SENTINELS = [LIST_TITLE, NEW_LIST_TITLE, ITEM_NAME, NEW_ITEM_NAME];

const user = { id: 'test-user-1', username: 'testuser' };

const list = {
    id: 'list-1',
    title: LIST_TITLE,
    dateAdded: new Date('2026-01-01'),
    items: [{ id: 'item-1', name: ITEM_NAME, dateAdded: new Date('2026-01-01'), isSelected: false }],
    users: [user],
    ownerId: user.id,
    listType: ListType.SHOPPING,
};

const mockListService = {
    getList: vi.fn(),
    getListsForUser: vi.fn(),
    addList: vi.fn(),
    addItem: vi.fn(),
    addItems: vi.fn(),
    updateItemName: vi.fn(),
    setItemSelected: vi.fn(),
    updateItemQuantity: vi.fn(),
    setItemCategory: vi.fn(),
    deleteItem: vi.fn(),
    updateListTitle: vi.fn(),
    deleteList: vi.fn(),
    clearList: vi.fn(),
    clearSelectedItems: vi.fn(),
    addUserToList: vi.fn(),
    removeUserFromList: vi.fn(),
};

const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

const mockAuthorizationService = {
    isListOwner: vi.fn(),
    canManageUsers: vi.fn(),
    getEffectiveOwnerId: vi.fn(),
};

const loggedText = (): string =>
    JSON.stringify(
        [mockLogger.info, mockLogger.warn, mockLogger.error, mockLogger.debug].flatMap((fn) => fn.mock.calls),
        (_key, value) => (value instanceof Error ? { name: value.name, message: value.message } : value)
    ).toLowerCase();

const callCount = () =>
    mockLogger.info.mock.calls.length + mockLogger.warn.mock.calls.length + mockLogger.error.mock.calls.length;

const createContext = (params: Record<string, string>, body: unknown = {}) =>
    ({
        req: {
            param: (name: string) => params[name],
            json: vi.fn().mockResolvedValue(body),
            header: (_name: string): undefined => undefined,
        },
        header: vi.fn(),
        json: (payload: unknown, status: number) =>
            new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }),
        get: (key: string) => (key === 'user' ? user : undefined),
        set: vi.fn(),
    }) as unknown as Context<{ Variables: { user: typeof user } }>;

const ref = { title: LIST_TITLE };
const itemRef = { title: LIST_TITLE, itemId: 'item-1' };

const handlers: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: 'reading a list', run: () => listHandlers.getList(createContext(ref)) },
    {
        name: 'creating a list',
        run: () => listHandlers.addList(createContext({}, { title: LIST_TITLE, dateAdded: new Date(), id: 'list-1' })),
    },
    {
        name: 'adding an item',
        run: () => listHandlers.addItem(createContext(ref, { itemName: NEW_ITEM_NAME, dateAdded: new Date() })),
    },
    {
        name: 'adding items in bulk',
        run: () =>
            listHandlers.addItems(createContext(ref, { items: [{ itemName: NEW_ITEM_NAME, dateAdded: new Date() }] })),
    },
    {
        name: 'renaming an item',
        run: () => listHandlers.updateItem(createContext(itemRef, { newItemName: NEW_ITEM_NAME })),
    },
    {
        name: 'sending an item update with no recognised field',
        run: () => listHandlers.updateItem(createContext(itemRef, { isSelected: NEW_ITEM_NAME })),
    },
    { name: 'selecting an item', run: () => listHandlers.updateItem(createContext(itemRef, { isSelected: true })) },
    { name: 'deleting an item', run: () => listHandlers.deleteItem(createContext(itemRef)) },
    { name: 'deleting a list', run: () => listHandlers.deleteList(createContext(ref)) },
    { name: 'renaming a list', run: () => listHandlers.updateList(createContext(ref, { newTitle: NEW_LIST_TITLE })) },
    { name: 'clearing a list', run: () => listHandlers.clearList(createContext(ref)) },
    { name: 'clearing selected items', run: () => listHandlers.deleteSelected(createContext(ref)) },
    {
        name: 'adding a member',
        run: () => listHandlers.addUserToList(createContext(ref, { friendId: 'friend-1' })),
    },
    {
        name: 'removing a member',
        run: () => listHandlers.removeUserFromList(createContext({ ...ref, userId: 'member-2' })),
    },
    {
        name: 'setting an item category',
        run: () => setItemCategory(createContext(itemRef, { category: 'produce' })),
    },
];

describe('ListHandlers logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockImplementation((token: string) => {
            if (token === 'ListService') return mockListService;

            if (token === 'Logger') return mockLogger;

            if (token === 'AuthorizationService') return mockAuthorizationService;

            return null;
        });
        mockAuthorizationService.isListOwner.mockReturnValue(true);
        mockAuthorizationService.canManageUsers.mockReturnValue(true);
        mockAuthorizationService.getEffectiveOwnerId.mockReturnValue(user.id);

        const result = { ...list, message: 'ok', newTitle: NEW_LIST_TITLE, newItemName: NEW_ITEM_NAME };

        mockListService.getList.mockResolvedValue(list);
        mockListService.getListsForUser.mockResolvedValue([list]);
        mockListService.addList.mockResolvedValue(list);
        mockListService.addItem.mockResolvedValue({ id: 'item-2', name: NEW_ITEM_NAME });
        mockListService.addItems.mockResolvedValue({ added: 1, skipped: 0 });
        mockListService.updateItemName.mockResolvedValue(result);
        mockListService.setItemSelected.mockResolvedValue(result);
        mockListService.updateItemQuantity.mockResolvedValue(result);
        mockListService.setItemCategory.mockResolvedValue(result);
        mockListService.deleteItem.mockResolvedValue(list);
        mockListService.updateListTitle.mockResolvedValue(result);
        mockListService.deleteList.mockResolvedValue(result);
        mockListService.clearList.mockResolvedValue(list);
        mockListService.clearSelectedItems.mockResolvedValue(list);
        mockListService.addUserToList.mockResolvedValue(list);
        mockListService.removeUserFromList.mockResolvedValue(list);
    });

    describe('When a request succeeds', () => {
        it.each(handlers)('should log no list title or item name when $name', async ({ run }) => {
            await run();

            expect(callCount()).toBeGreaterThan(0);

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });
    });

    describe('When the service fails after the caller was let in', () => {
        it.each(handlers)('should log no list title or item name when $name', async ({ run }) => {
            for (const fn of Object.values(mockListService)) {
                if (fn !== mockListService.getList)
                    fn.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
            }

            await run().catch((): void => undefined);

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });
    });

    describe('When the caller is not a member of the list', () => {
        it('should log no list title when refusing access', async () => {
            mockListService.getList.mockResolvedValue({ ...list, users: [{ id: 'someone-else', username: 'x' }] });

            await listHandlers.getList(createContext(ref));
            await setItemCategory(createContext(itemRef, { category: 'produce' }));

            expect(mockLogger.warn).toHaveBeenCalled();

            for (const sentinel of SENTINELS) {
                expect(loggedText()).not.toContain(sentinel);
            }
        });
    });
});
