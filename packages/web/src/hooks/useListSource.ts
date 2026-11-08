import type { ItemCategory, ListResponse, ListType, User } from '@tandra/types';

import { clearList, clearSelected, deleteList, getListQuery, getListsQuery, updateListName } from '../api';
import { useUser } from '../auth';
import { useGuest } from '../guest/GuestContext';
import { GUEST_USER, guestListSource } from '../guest/guestListSource';
import { drainOutbox } from '../offline/drainer';
import type { ListItemsData } from '../offline/foldPending';
import type { ItemOp, OutboxPayload } from '../offline/outboxStore';
import { outboxStore } from '../offline/outboxStore';

// Where the lists and items pages read and write. Signed-in users go through the API and the offline outbox;
// guests go through the IndexedDB guest store. Both sources share the query keys (`['lists', userId]` and
// `[listRef]`) and data shapes, so the pages, optimistic updates and invalidations are the same for both.
export interface ListSource {
    listsQuery: (userId: string) => { queryKey: string[]; queryFn: () => Promise<ListResponse[]> };
    listQuery: (listRef: string) => { queryKey: string[]; queryFn: () => Promise<ListItemsData> };
    createList: (list: {
        id: string;
        title: string;
        listType: ListType;
        selectedUsers: string[];
        user: User;
    }) => Promise<void>;
    renameList: (listRef: string, newTitle: string) => Promise<void>;
    deleteList: (listRef: string) => Promise<void>;
    addItem: (listRef: string, item: { id: string; name: string; quantity?: number; unit?: string }) => Promise<void>;
    toggleItem: (listRef: string, itemId: string, isSelected: boolean) => Promise<void>;
    renameItem: (listRef: string, itemId: string, name: string) => Promise<void>;
    setItemQuantity: (listRef: string, itemId: string, change: { quantity?: number; unit?: string }) => Promise<void>;
    setItemCategory: (listRef: string, itemId: string, category: ItemCategory) => Promise<void>;
    deleteItem: (listRef: string, itemId: string) => Promise<void>;
    clearSelected: (listRef: string) => Promise<void>;
    clearList: (listRef: string) => Promise<void>;
}

const enqueue = async (
    entityType: 'item' | 'list',
    op: ItemOp | 'list.create',
    scope: string,
    targetId: string,
    payload: OutboxPayload
) => {
    await outboxStore.enqueue({
        id: crypto.randomUUID(),
        entityType,
        op,
        targetId,
        scope,
        payload,
        createdAt: Date.now(),
    });
    void drainOutbox();
};

const serverListSource: ListSource = {
    listsQuery: getListsQuery,
    listQuery: getListQuery,
    createList: ({ id, title, listType, selectedUsers, user }) =>
        enqueue('list', 'list.create', user.id, id, { title, listType, selectedUsers, user, ownerId: user.id }),
    renameList: async (listRef, newTitle) => {
        await updateListName(listRef, newTitle);
    },
    deleteList: async (listRef) => {
        await deleteList(listRef);
    },
    addItem: (listRef, { id, name, quantity, unit }) =>
        enqueue('item', 'item.add', listRef, id, {
            name,
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
        }),
    toggleItem: (listRef, itemId, isSelected) => enqueue('item', 'item.toggle', listRef, itemId, { isSelected }),
    renameItem: (listRef, itemId, name) => enqueue('item', 'item.rename', listRef, itemId, { newItemName: name }),
    setItemQuantity: (listRef, itemId, { quantity, unit }) =>
        enqueue('item', 'item.quantity', listRef, itemId, {
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
        }),
    setItemCategory: (listRef, itemId, category) => enqueue('item', 'item.category', listRef, itemId, { category }),
    deleteItem: (listRef, itemId) => enqueue('item', 'item.delete', listRef, itemId, {}),
    clearSelected: async (listRef) => {
        await clearSelected(listRef);
    },
    clearList: async (listRef) => {
        await clearList(listRef);
    },
};

export const useListSource = (): ListSource => (useGuest().isGuest ? guestListSource : serverListSource);

// The user the lists page is keyed and ownership-checked by: the signed-in account, or the on-device guest.
export const useListUser = (): User | undefined => {
    const { user } = useUser();

    return useGuest().isGuest ? GUEST_USER : user;
};
