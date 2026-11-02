import type { ListType, User } from '@tandra/types';

import { addItem, addList, updateItem } from '../api';
import { logger } from '../utils/logger';
import { type GuestItem, guestStore } from './guestStore';

// Migration pushes every guest list to the server, then every item inside it.
// Title clashes with lists the user already owns get a numeric suffix and
// are retried; everything else surfaces as a per-list failure so the rest of
// the migration can still proceed. Each uploaded list is removed from the
// guest store at once, so the store ends up holding only the lists that
// failed, ready for the next sign-in to retry.

export interface MigrateAdapter {
    addList: (title: string, listType: ListType) => Promise<unknown>;
    addItem: (input: {
        listTitle: string;
        id: string;
        name: string;
        quantity?: number;
        unit?: string;
    }) => Promise<unknown>;
    selectItem: (input: { listTitle: string; id: string }) => Promise<unknown>;
}

export interface MigrationFailure {
    listTitle: string;
    reason: string;
}

export interface MigrationResult {
    listsUploaded: number;
    itemsUploaded: number;
    listsRenamed: number;
    /** Total list-level failures. Those lists stay in the guest store for a retry. */
    listFailures: number;
    failures: Array<MigrationFailure>;
}

const MAX_RENAME_ATTEMPTS = 100;

const statusOf = (err: unknown): number | undefined => {
    const status = err instanceof Error && 'status' in err ? err.status : undefined;
    return typeof status === 'number' ? status : undefined;
};

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const createLiveMigrateAdapter = (user: User): MigrateAdapter => ({
    async addList(title, listType) {
        return await addList(title, user, undefined, listType);
    },
    async addItem({ listTitle, id, name, quantity, unit }) {
        return await addItem(name, listTitle, quantity, unit, id);
    },
    async selectItem({ listTitle, id }) {
        return await updateItem(id, true, listTitle);
    },
});

// fallow-ignore-next-line complexity
const uploadListWithRename = async (listTitle: string, listType: ListType, adapter: MigrateAdapter) => {
    let attempt = 0;
    let candidate = listTitle;
    // First try the original title; on a 409 the server says the user already
    // has a list of this name, so we append " (1)", " (2)", ... until either
    // it lands or we exhaust the bound.
    while (attempt < MAX_RENAME_ATTEMPTS) {
        try {
            await adapter.addList(candidate, listType);
            return { uploadedTitle: candidate, renamed: attempt > 0 };
        } catch (err) {
            if (statusOf(err) !== 409) throw err;
            attempt += 1;
            candidate = attempt === 1 ? `${listTitle} (1)` : `${listTitle} (${attempt})`;
        }
    }
    throw new Error(`Could not find a free title for "${listTitle}" after ${MAX_RENAME_ATTEMPTS} attempts`);
};

export interface MigrateOptions {
    /** Override for tests; defaults to the live IndexedDB store. */
    store?: typeof guestStore;
}

// Uploads one list's items; failures are recorded, not thrown, because the
// list itself already lives on the server and a retry won't fix one item.
// fallow-ignore-next-line complexity
const uploadItems = async (
    items: Array<GuestItem>,
    listTitle: string,
    adapter: MigrateAdapter,
    result: MigrationResult
) => {
    for (const item of items) {
        try {
            // Reusing the guest id keeps the upload idempotent on retry
            // and lets the ticked state follow the item.
            await adapter.addItem({
                listTitle,
                id: item.id,
                name: item.name,
                ...(item.quantity !== undefined && { quantity: item.quantity }),
                ...(item.unit !== undefined && { unit: item.unit }),
            });
            if (item.isSelected) await adapter.selectItem({ listTitle, id: item.id });
            result.itemsUploaded += 1;
        } catch (err) {
            const reason = messageOf(err);
            logger.error('Failed to migrate guest item', { listTitle, itemName: item.name, reason });
            result.failures.push({ listTitle, reason: `item "${item.name}": ${reason}` });
        }
    }
};

// fallow-ignore-next-line complexity
export const migrateGuestToAccount = async (
    user: User,
    adapter: MigrateAdapter = createLiveMigrateAdapter(user),
    options: MigrateOptions = {}
): Promise<MigrationResult> => {
    const store = options.store ?? guestStore;
    // The in-memory mirror is only filled once a guest page has rendered; a
    // guest who reloads straight onto /register would otherwise look empty.
    await store.hydrate();
    const snapshot = store.snapshot();
    const result: MigrationResult = {
        listsUploaded: 0,
        itemsUploaded: 0,
        listsRenamed: 0,
        listFailures: 0,
        failures: [],
    };

    if (snapshot.lists.length === 0) return result;

    logger.info('Migrating guest data to account', { listCount: snapshot.lists.length });

    for (const list of snapshot.lists) {
        let uploaded: { uploadedTitle: string; renamed: boolean };
        try {
            uploaded = await uploadListWithRename(list.title, list.listType, adapter);
        } catch (err) {
            // The list stays in the guest store so the next sign-in retries it.
            const reason = messageOf(err);
            logger.error('Failed to migrate guest list', { listTitle: list.title, reason });
            result.listFailures += 1;
            result.failures.push({ listTitle: list.title, reason });
            continue;
        }

        result.listsUploaded += 1;
        if (uploaded.renamed) {
            result.listsRenamed += 1;
            logger.info('Renamed guest list during migration', { from: list.title, to: uploaded.uploadedTitle });
        }
        await uploadItems(snapshot.itemsByList.get(list.id) ?? [], uploaded.uploadedTitle, adapter, result);
        // Drop it locally right away so a retry after a partial failure
        // doesn't upload it a second time under a "(1)" title.
        await store.deleteList(list.id);
    }

    logger.info('Guest data migration finished', { ...result, failures: result.failures.length });
    return result;
};
