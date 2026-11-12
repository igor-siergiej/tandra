import 'fake-indexeddb/auto';
import { ListType, type User } from '@tandra/types';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { guestStore } from './guestStore';
import { type MigrateAdapter, migrateGuestToAccount } from './migrateGuestToAccount';

const user: User = { id: 'u1', username: 'alice' };

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

const recordingAdapter = (
    overrides: Partial<MigrateAdapter> = {}
): MigrateAdapter & {
    calls: Array<{ kind: 'addList' | 'addItem' | 'selectItem'; args: unknown }>;
} => {
    const calls: Array<{ kind: 'addList' | 'addItem' | 'selectItem'; args: unknown }> = [];

    return {
        calls,
        async addList(title, listType) {
            calls.push({ kind: 'addList', args: { title, listType } });

            if (overrides.addList) return await overrides.addList(title, listType);

            return null;
        },
        async addItem(input) {
            calls.push({ kind: 'addItem', args: input });

            if (overrides.addItem) return await overrides.addItem(input);

            return null;
        },
        async selectItem(input) {
            calls.push({ kind: 'selectItem', args: input });

            if (overrides.selectItem) return await overrides.selectItem(input);

            return null;
        },
    };
};

describe('migrateGuestToAccount', () => {
    beforeEach(async () => {
        await guestStore.clear();
    });

    it('returns an empty result and never calls the adapter when there is no guest data', async () => {
        const adapter = recordingAdapter();

        const result = await migrateGuestToAccount(user, adapter);

        expect(result).toEqual({ listsUploaded: 0, itemsUploaded: 0, listsRenamed: 0, listFailures: 0, failures: [] });
        expect(adapter.calls).toHaveLength(0);
        expect(guestStore.count()).toBe(0);
    });

    it('uploads every list and item, then clears the store', async () => {
        const listA = await guestStore.createList({ title: 'Groceries' });
        await guestStore.addItem({ listId: listA.id, name: 'Apples' });
        await guestStore.addItem({ listId: listA.id, name: 'Pears', quantity: 2 });
        const listB = await guestStore.createList({ title: 'Hardware' });
        await guestStore.addItem({ listId: listB.id, name: 'Nails' });

        const adapter = recordingAdapter();
        const result = await migrateGuestToAccount(user, adapter);

        expect(result.listsUploaded).toBe(2);
        expect(result.itemsUploaded).toBe(3);
        expect(result.listsRenamed).toBe(0);
        expect(result.failures).toEqual([]);
        expect(guestStore.count()).toBe(0);
        expect(guestStore.itemCount()).toBe(0);
    });

    it('uploads items under their guest id and re-ticks only the ticked ones', async () => {
        const list = await guestStore.createList({ title: 'Groceries' });
        const apples = await guestStore.addItem({ listId: list.id, name: 'Apples' });
        const pears = await guestStore.addItem({ listId: list.id, name: 'Pears' });
        await guestStore.toggleItem(apples.id, true);

        const adapter = recordingAdapter();
        await migrateGuestToAccount(user, adapter);

        expect(adapter.calls.filter((call) => call.kind !== 'addList')).toEqual([
            { kind: 'addItem', args: { listTitle: 'Groceries', id: apples.id, name: 'Apples' } },
            { kind: 'selectItem', args: { listTitle: 'Groceries', id: apples.id } },
            { kind: 'addItem', args: { listTitle: 'Groceries', id: pears.id, name: 'Pears' } },
        ]);
    });

    it('renames a list on a 409 clash and retries with a numeric suffix', async () => {
        await guestStore.createList({ title: 'Groceries' });

        const adapter = recordingAdapter({
            addList: (async (title: string) => {
                if (title === 'Groceries') throw httpError(409, 'A list with that name already exists');
            }) as MigrateAdapter['addList'],
        });

        const result = await migrateGuestToAccount(user, adapter);

        expect(result.listsUploaded).toBe(1);
        expect(result.listsRenamed).toBe(1);
        expect(adapter.calls[0].args).toEqual({ title: 'Groceries', listType: ListType.SHOPPING });
        expect(adapter.calls[1].args).toEqual({ title: 'Groceries (1)', listType: ListType.SHOPPING });
        expect(guestStore.count()).toBe(0);
    });

    it('surfaces non-409 list failures and keeps the list and its items locally', async () => {
        const list = await guestStore.createList({ title: 'Groceries' });
        await guestStore.addItem({ listId: list.id, name: 'Apples' });

        const adapter = recordingAdapter({
            addList: (async () => {
                throw httpError(500, 'kaboom');
            }) as MigrateAdapter['addList'],
        });

        const result = await migrateGuestToAccount(user, adapter);

        expect(result.listsUploaded).toBe(0);
        expect(result.itemsUploaded).toBe(0);
        expect(result.failures).toEqual([{ listTitle: 'Groceries', reason: 'kaboom' }]);
        expect(guestStore.count()).toBe(1);
        expect(guestStore.itemCount()).toBe(1);
    });

    it('records an item failure but still drops the uploaded list locally', async () => {
        const list = await guestStore.createList({ title: 'Groceries' });
        await guestStore.addItem({ listId: list.id, name: 'Apples' });

        const adapter = recordingAdapter({
            addItem: (async () => {
                throw httpError(400, 'rejected');
            }) as MigrateAdapter['addItem'],
        });

        const result = await migrateGuestToAccount(user, adapter);

        expect(result.listsUploaded).toBe(1);
        expect(result.itemsUploaded).toBe(0);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].listTitle).toBe('Groceries');
        expect(result.failures[0].reason).toContain('Apples');
        expect(guestStore.count()).toBe(0);
    });

    it('keeps only the failed lists, so a retry does not re-upload the good ones', async () => {
        await guestStore.createList({ title: 'Bad' });
        const good = await guestStore.createList({ title: 'Good' });
        await guestStore.addItem({ listId: good.id, name: 'Apples' });

        let badFails = true;

        const adapter = recordingAdapter({
            addList: (async (title: string) => {
                if (title === 'Bad' && badFails) throw httpError(500, 'nope');
            }) as MigrateAdapter['addList'],
        });

        const result = await migrateGuestToAccount(user, adapter);

        expect(result.listsUploaded).toBe(1);
        expect(result.itemsUploaded).toBe(1);
        expect(result.failures).toEqual([{ listTitle: 'Bad', reason: 'nope' }]);
        expect(guestStore.peekLists().map((list) => list.title)).toEqual(['Bad']);

        badFails = false;
        adapter.calls.length = 0;
        const retry = await migrateGuestToAccount(user, adapter);

        expect(retry.listsUploaded).toBe(1);
        expect(adapter.calls).toEqual([{ kind: 'addList', args: { title: 'Bad', listType: ListType.SHOPPING } }]);
        expect(guestStore.count()).toBe(0);
    });
});
