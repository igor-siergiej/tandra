import { describe, expect, it } from 'bun:test';

import type { Item, List } from '@tandra/types';
import { ListType } from '@tandra/types';

import type { IdGenerator } from '../IdGenerator';
import type { ListRepository } from '../ListRepository';
import { ListService } from './index';

// Every repository call yields first, so two overlapping requests really do interleave (both read, then both
// write) the way they do against Mongo over the network. A microtask rather than a timer keeps this independent
// of fake timers other test files may leave installed.
const yieldToEventLoop = () => Promise.resolve();

/** One list in memory with Mongo's write semantics: reads are copies, writes land whole or not at all. */
class SingleListRepository implements ListRepository {
    private doc: List;
    /** When set, every compare-and-swap loses, as if another writer always got there first. */
    alwaysConflict = false;

    constructor(list: List) {
        this.doc = structuredClone(list);
    }

    snapshot(): List {
        return structuredClone(this.doc);
    }

    async ensureIndexes(): Promise<void> {}

    async getByRef(ref: string): Promise<List | null> {
        await yieldToEventLoop();
        return ref === this.doc.id || ref === this.doc.title ? structuredClone(this.doc) : null;
    }

    async replaceIfUnchanged(listId: string, list: List): Promise<number | null> {
        await yieldToEventLoop();
        if (this.alwaysConflict || listId !== this.doc.id || (this.doc.revision ?? 0) !== (list.revision ?? 0)) {
            return null;
        }
        const revision = (this.doc.revision ?? 0) + 1;
        this.doc = { ...structuredClone(list), revision };
        return revision;
    }

    async pushItem(listId: string, item: Item): Promise<void> {
        await yieldToEventLoop();
        if (listId !== this.doc.id) return;
        this.doc.items.push(structuredClone(item));
        this.doc.revision = (this.doc.revision ?? 0) + 1;
    }

    async getAll(): Promise<Array<List>> {
        return [this.snapshot()];
    }

    async findByUserId(): Promise<Array<List>> {
        return [this.snapshot()];
    }

    async insert(): Promise<void> {}

    async deleteById(): Promise<void> {}

    async removeMemberFromAll(): Promise<void> {}
}

class CountingIds implements IdGenerator {
    private n = 0;
    generate(): string {
        return `gen-${++this.n}`;
    }
}

const item = (id: string, overrides: Partial<Item> = {}): Item => ({
    id,
    name: id,
    isSelected: false,
    dateAdded: new Date('2024-01-01'),
    ...overrides,
});

const setup = (items: Array<Item>) => {
    const repo = new SingleListRepository({
        id: 'list-1',
        title: 'Groceries',
        dateAdded: new Date('2024-01-01'),
        items,
        users: [{ id: 'u1', username: 'one' }],
        listType: ListType.SHOPPING,
        ownerId: 'u1',
    });
    const service = new ListService(repo, new CountingIds());
    return { repo, service };
};

const names = (list: List) => list.items.map((i) => i.name).sort();

describe('ListService concurrent edits', () => {
    it('keeps both toggles when two items on one list are ticked at the same time', async () => {
        const { repo, service } = setup([item('eggs'), item('milk')]);

        await Promise.all([
            service.setItemSelected('Groceries', 'eggs', true),
            service.setItemSelected('Groceries', 'milk', true),
        ]);

        expect(repo.snapshot().items.map((i) => i.isSelected)).toEqual([true, true]);
    });

    it('keeps an item that is added while another item is being ticked', async () => {
        const { repo, service } = setup([item('eggs')]);

        await Promise.all([
            service.addItem('Groceries', 'bread', new Date()),
            service.setItemSelected('Groceries', 'eggs', true),
        ]);

        const list = repo.snapshot();
        expect(names(list)).toEqual(['bread', 'eggs']);
        expect(list.items.find((i) => i.name === 'eggs')?.isSelected).toBe(true);
    });

    it('deletes both items when two are deleted at the same time', async () => {
        const { repo, service } = setup([item('eggs'), item('milk'), item('tea')]);

        await Promise.all([service.deleteItem('Groceries', 'eggs'), service.deleteItem('Groceries', 'milk')]);

        expect(names(repo.snapshot())).toEqual(['tea']);
    });

    it('applies a rename and a quantity change made at the same time', async () => {
        const { repo, service } = setup([item('eggs'), item('milk')]);

        await Promise.all([
            service.updateItemName('Groceries', 'eggs', 'free-range eggs'),
            service.updateItemQuantity('Groceries', 'milk', 2, 'l'),
        ]);

        const list = repo.snapshot();
        expect(list.items.find((i) => i.id === 'eggs')?.name).toBe('free-range eggs');
        expect(list.items.find((i) => i.id === 'milk')).toMatchObject({ quantity: 2, unit: 'l' });
    });

    it('keeps a tick that lands while a bulk add is in flight', async () => {
        const { repo, service } = setup([item('eggs')]);

        await Promise.all([
            service.addItems('Groceries', [{ itemName: 'flour', dateAdded: new Date() }], 'u1'),
            service.setItemSelected('Groceries', 'eggs', true),
        ]);

        const list = repo.snapshot();
        expect(names(list)).toEqual(['eggs', 'flour']);
        expect(list.items.find((i) => i.name === 'eggs')?.isSelected).toBe(true);
    });

    it('does not resurrect an item that a concurrent clear-selected removed', async () => {
        const { repo, service } = setup([item('eggs', { isSelected: true }), item('milk')]);

        await Promise.all([
            service.clearSelectedItems('Groceries'),
            service.setItemSelected('Groceries', 'milk', true),
        ]);

        // Whichever order they serialise in, no write may be dropped: eggs is gone, and milk is either
        // still there ticked, or was cleared because the tick landed first.
        const list = repo.snapshot();
        expect(list.items.find((i) => i.name === 'eggs')).toBeUndefined();
        for (const remaining of list.items) expect(remaining.name).toBe('milk');
    });

    it('still reports a missing item as 404 after a concurrent delete', async () => {
        const { service } = setup([item('eggs')]);

        const [deleted, toggled] = await Promise.allSettled([
            service.deleteItem('Groceries', 'eggs'),
            service.setItemSelected('Groceries', 'eggs', true),
        ]);

        expect(deleted.status).toBe('fulfilled');
        // The toggle either ran first (fulfilled) or lost to the delete and must say so honestly.
        if (toggled.status === 'rejected') expect(toggled.reason).toMatchObject({ status: 404 });
    });

    it('gives up with 503 instead of looping forever when the list never stops changing', async () => {
        const { repo, service } = setup([item('eggs')]);
        repo.alwaysConflict = true;

        await expect(service.setItemSelected('Groceries', 'eggs', true)).rejects.toMatchObject({ status: 503 });
    });
});
