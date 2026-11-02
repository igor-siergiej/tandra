import { type ItemCategory, ListType } from '@tandra/types';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

// Local-only store for guest sessions: lists and items are persisted in
// IndexedDB so a guest can browse the app, create lists, and add items
// without ever touching the API. On sign-up / log-in the contents are
// migrated to the server (see `migrateGuestToAccount.ts`).

export interface GuestList {
    id: string;
    title: string;
    listType: ListType;
    createdAt: number;
}

export interface GuestItem {
    id: string;
    listId: string;
    name: string;
    isSelected: boolean;
    quantity?: number;
    unit?: string;
    category?: ItemCategory;
    createdAt: number;
    /** Monotonic counter for stable ordering when two items land in the same millisecond. */
    seq: number;
}

interface GuestDB extends DBSchema {
    lists: { key: string; value: GuestList };
    items: { key: string; value: GuestItem; indexes: { 'by-list': string } };
}

const DB_NAME = 'tandra-guest';
const LISTS_STORE = 'lists';
const ITEMS_STORE = 'items';

let dbPromise: Promise<IDBPDatabase<GuestDB>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<GuestDB>(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(LISTS_STORE, { keyPath: 'id' });
                const items = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
                items.createIndex('by-list', 'listId');
            },
        });
    }

    return dbPromise;
};

let listsMirror: GuestList[] = [];
const itemsByListMirror = new Map<string, GuestItem[]>();

const sortLists = (a: GuestList, b: GuestList) => a.createdAt - b.createdAt;
const sortItems = (a: GuestItem, b: GuestItem) => a.seq - b.seq;

// Monotonic counter so two items queued in the same millisecond still have a
// deterministic order across an IDB read-back. Resets only at module load.
let nextSeq = 0;

// Trims `title` and rejects blanks and case-insensitive clashes with any list
// other than `ownId`.
const assertFreeTitle = (title: string, ownId?: string): string => {
    const trimmed = title.trim();

    if (!trimmed) throw new Error('List name is required');
    const clash = listsMirror.some((l) => l.id !== ownId && l.title.toLowerCase() === trimmed.toLowerCase());

    if (clash) throw new Error('A list with that name already exists');

    return trimmed;
};

// Applies `patch` to one stored item, in IndexedDB and the mirror.
const patchItem = async (
    itemId: string,
    patch: Partial<Pick<GuestItem, 'isSelected' | 'name' | 'quantity' | 'unit' | 'category'>>
) => {
    const db = await getDB();
    const existing = await db.get(ITEMS_STORE, itemId);

    if (!existing) return;
    const next: GuestItem = { ...existing, ...patch };
    await db.put(ITEMS_STORE, next);
    const bucket = itemsByListMirror.get(existing.listId) ?? [];
    itemsByListMirror.set(
        existing.listId,
        bucket.map((it) => (it.id === itemId ? next : it))
    );
};

// Deletes a list's items matching `shouldDelete`, in IndexedDB and the mirror.
const deleteListItems = async (listId: string, shouldDelete: (item: GuestItem) => boolean) => {
    const db = await getDB();
    const tx = db.transaction(ITEMS_STORE, 'readwrite');
    let cursor = await tx.store.index('by-list').openCursor(listId);

    while (cursor) {
        if (shouldDelete(cursor.value)) await cursor.delete();
        cursor = await cursor.continue();
    }

    await tx.done;
    const bucket = itemsByListMirror.get(listId) ?? [];
    itemsByListMirror.set(
        listId,
        bucket.filter((it) => !shouldDelete(it))
    );
};

export interface GuestSnapshot {
    lists: GuestList[];
    itemsByList: Map<string, GuestItem[]>;
}

export const guestStore = {
    /** Loads everything from IndexedDB into the in-memory mirror. Guest queries call it on every fetch. */
    // fallow-ignore-next-line complexity
    async hydrate() {
        const db = await getDB();
        listsMirror = (await db.getAll(LISTS_STORE)).sort(sortLists);
        const items = await db.getAll(ITEMS_STORE);
        itemsByListMirror.clear();
        let maxSeq = 0;

        for (const item of items) {
            const bucket = itemsByListMirror.get(item.listId) ?? [];
            bucket.push(item);
            itemsByListMirror.set(item.listId, bucket);

            if (item.seq > maxSeq) maxSeq = item.seq;
        }

        for (const bucket of itemsByListMirror.values()) {
            bucket.sort(sortItems);
        }

        // Resume the in-memory counter past any persisted items so freshly-added
        // items don't tie with — and reorder — ones already in IDB.
        if (maxSeq > nextSeq) nextSeq = maxSeq;
    },

    /** Returns a fresh array — callers may sort or filter without mutating the mirror. */
    peekLists(): GuestList[] {
        return [...listsMirror];
    },

    peekItems(listId: string): GuestItem[] {
        return [...(itemsByListMirror.get(listId) ?? [])];
    },

    count(): number {
        return listsMirror.length;
    },

    itemCount(): number {
        let total = 0;

        for (const bucket of itemsByListMirror.values()) total += bucket.length;

        return total;
    },

    /** `id` lets the caller key its optimistic row before the write lands, like the server flow. */
    async createList(input: { id?: string; title: string; listType?: ListType }): Promise<GuestList> {
        const list: GuestList = {
            id: input.id ?? crypto.randomUUID(),
            title: assertFreeTitle(input.title),
            listType: input.listType ?? ListType.SHOPPING,
            createdAt: Date.now(),
        };

        const db = await getDB();
        await db.put(LISTS_STORE, list);
        listsMirror = [...listsMirror, list].sort(sortLists);

        return list;
    },

    /** Renames in place: the id, position and items (with their ticks) are untouched. */
    async renameList(listId: string, title: string): Promise<void> {
        const existing = listsMirror.find((l) => l.id === listId);

        if (!existing) throw new Error('List not found');
        const next: GuestList = { ...existing, title: assertFreeTitle(title, listId) };
        const db = await getDB();
        await db.put(LISTS_STORE, next);
        listsMirror = listsMirror.map((l) => (l.id === listId ? next : l));
    },

    async deleteList(listId: string): Promise<void> {
        const db = await getDB();
        const tx = db.transaction([LISTS_STORE, ITEMS_STORE], 'readwrite');
        await tx.objectStore(LISTS_STORE).delete(listId);
        const index = tx.objectStore(ITEMS_STORE).index('by-list');
        let cursor = await index.openCursor(listId);

        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }

        await tx.done;
        listsMirror = listsMirror.filter((l) => l.id !== listId);
        itemsByListMirror.delete(listId);
    },

    // fallow-ignore-next-line complexity
    async addItem(input: {
        id?: string;
        listId: string;
        name: string;
        quantity?: number;
        unit?: string;
    }): Promise<GuestItem> {
        const name = input.name.trim();

        if (!name) throw new Error('Item name is required');
        const list = listsMirror.find((l) => l.id === input.listId);

        if (!list) throw new Error('List not found');

        const item: GuestItem = {
            id: input.id ?? crypto.randomUUID(),
            listId: input.listId,
            name,
            isSelected: false,
            ...(input.quantity !== undefined && { quantity: input.quantity }),
            ...(input.unit !== undefined && { unit: input.unit }),
            createdAt: Date.now(),
            seq: ++nextSeq,
        };

        const db = await getDB();
        await db.put(ITEMS_STORE, item);
        const bucket = itemsByListMirror.get(input.listId) ?? [];
        itemsByListMirror.set(input.listId, [...bucket, item].sort(sortItems));

        return item;
    },

    async toggleItem(itemId: string, isSelected: boolean): Promise<void> {
        await patchItem(itemId, { isSelected });
    },

    async updateItemName(itemId: string, name: string): Promise<void> {
        const trimmed = name.trim();

        if (!trimmed) throw new Error('Item name is required');
        await patchItem(itemId, { name: trimmed });
    },

    /** Like the server, only the fields passed are changed. */
    async updateItemQuantity(itemId: string, { quantity, unit }: { quantity?: number; unit?: string }): Promise<void> {
        await patchItem(itemId, {
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
        });
    },

    async updateItemCategory(itemId: string, category: ItemCategory): Promise<void> {
        await patchItem(itemId, { category });
    },

    async deleteItem(itemId: string): Promise<void> {
        const db = await getDB();
        const existing = await db.get(ITEMS_STORE, itemId);

        if (!existing) return;
        await db.delete(ITEMS_STORE, itemId);
        const bucket = itemsByListMirror.get(existing.listId) ?? [];
        itemsByListMirror.set(
            existing.listId,
            bucket.filter((it) => it.id !== itemId)
        );
    },

    async clearList(listId: string): Promise<void> {
        await deleteListItems(listId, () => true);
    },

    async clearSelected(listId: string): Promise<void> {
        await deleteListItems(listId, (item) => item.isSelected);
    },

    /** Drops every list and item — used when a guest leaves guest mode. */
    async clear(): Promise<void> {
        const db = await getDB();
        const tx = db.transaction([LISTS_STORE, ITEMS_STORE], 'readwrite');
        await tx.objectStore(LISTS_STORE).clear();
        await tx.objectStore(ITEMS_STORE).clear();
        await tx.done;
        listsMirror = [];
        itemsByListMirror.clear();
    },

    /** Snapshots the current state so the migration can iterate without reacting to live writes. */
    snapshot(): GuestSnapshot {
        const itemsByList = new Map<string, GuestItem[]>();

        for (const list of listsMirror) {
            itemsByList.set(list.id, [...(itemsByListMirror.get(list.id) ?? [])]);
        }

        return { lists: [...listsMirror], itemsByList };
    },
};
