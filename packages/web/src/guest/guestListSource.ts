import type { Item, ListResponse, User } from '@tandra/types';

import type { ListSource } from '../hooks/useListSource';
import type { ListItemsData } from '../offline/foldPending';
import { type GuestItem, type GuestList, guestStore } from './guestStore';

// Stands in for the signed-in user while browsing as a guest, so the lists page, which is keyed and
// ownership-checked by user id, works unchanged. Guests own every list on their device.
export const GUEST_USER: User = { id: 'guest', username: 'Guest' };

const toItem = ({ id, name, isSelected, quantity, unit, category, createdAt }: GuestItem): Item => ({
    id,
    name,
    isSelected,
    dateAdded: new Date(createdAt),
    ...(quantity !== undefined && { quantity }),
    ...(unit !== undefined && { unit }),
    ...(category !== undefined && { category }),
});

const toListResponse = (list: GuestList): ListResponse => ({
    id: list.id,
    title: list.title,
    dateAdded: new Date(list.createdAt),
    items: guestStore.peekItems(list.id).map(toItem),
    users: [],
    listType: list.listType,
    ownerId: GUEST_USER.id,
});

// Every read re-hydrates from IndexedDB, so a reload straight onto a list (empty in-memory mirror) still
// finds it. Writes go straight to the store; the hooks own the optimistic cache updates and invalidation.
export const guestListSource: ListSource = {
    listsQuery: (userId) => ({
        queryKey: ['lists', userId],
        queryFn: async () => {
            await guestStore.hydrate();
            return guestStore.peekLists().map(toListResponse);
        },
    }),
    listQuery: (listRef) => ({
        queryKey: [listRef],
        queryFn: async (): Promise<ListItemsData> => {
            await guestStore.hydrate();
            const list = guestStore.peekLists().find((l) => l.id === listRef);
            if (!list) throw new Error('List not found');
            const { title, listType, items, users, ownerId } = toListResponse(list);
            return { title, listType, items, users, ownerId };
        },
    }),
    createList: async ({ id, title, listType }) => {
        await guestStore.createList({ id, title, listType });
    },
    renameList: (listRef, newTitle) => guestStore.renameList(listRef, newTitle),
    deleteList: (listRef) => guestStore.deleteList(listRef),
    addItem: async (listRef, { id, name, quantity, unit }) => {
        await guestStore.addItem({
            id,
            listId: listRef,
            name,
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
        });
    },
    toggleItem: (_listRef, itemId, isSelected) => guestStore.toggleItem(itemId, isSelected),
    renameItem: (_listRef, itemId, name) => guestStore.updateItemName(itemId, name),
    setItemQuantity: (_listRef, itemId, change) => guestStore.updateItemQuantity(itemId, change),
    setItemCategory: (_listRef, itemId, category) => guestStore.updateItemCategory(itemId, category),
    deleteItem: (_listRef, itemId) => guestStore.deleteItem(itemId),
    clearSelected: (listRef) => guestStore.clearSelected(listRef),
    clearList: (listRef) => guestStore.clearList(listRef),
};
