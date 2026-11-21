import { beforeEach, describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { Item, ItemCategory, List, User } from '@tandra/types';
import { ListType } from '@tandra/types';

import type { FriendService } from '../FriendService';
import type { IdGenerator } from '../IdGenerator';
import type { ListRepository } from '../ListRepository';
import { ListService } from './index';

// The privacy notice promises logs hold no list-item text: list titles and item names must never reach a log line.
const LIST_TITLE = 'quokkafest-list-title';
const NEW_LIST_TITLE = 'quokkafest-renamed-title';
const CLASH_TITLE = 'quokkafest-clash-title';
const LEGACY_TITLE = 'quokkafest-legacy-title';
const ITEM_NAME = 'dragonfruit-item-name';
const OTHER_ITEM_NAME = 'dragonfruit-other-item';
const NEW_ITEM_NAME = 'dragonfruit-new-item';
const SENTINELS = [LIST_TITLE, NEW_LIST_TITLE, CLASH_TITLE, LEGACY_TITLE, ITEM_NAME, OTHER_ITEM_NAME, NEW_ITEM_NAME];

class RecordingLogger {
    readonly entries: Array<{ level: string; args: unknown[] }> = [];

    private record(level: string, args: unknown[]) {
        this.entries.push({ level, args });
    }

    info(...args: unknown[]) {
        this.record('info', args);
    }
    warn(...args: unknown[]) {
        this.record('warn', args);
    }
    error(...args: unknown[]) {
        this.record('error', args);
    }
    debug(...args: unknown[]) {
        this.record('debug', args);
    }

    /** Everything the logger was handed, serialised the way a log line would be (Errors keep message and stack). */
    text(): string {
        return JSON.stringify(this.entries, (_key, value) =>
            value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value
        ).toLowerCase();
    }
}

class MemoryListRepository implements ListRepository {
    lists: Array<List> = [];

    async ensureIndexes(): Promise<void> {}
    async getByRef(ref: string): Promise<List | null> {
        return this.lists.find((l) => l.id === ref) ?? this.lists.find((l) => l.title === ref) ?? null;
    }
    async getAll(): Promise<Array<List>> {
        return this.lists;
    }
    async findByUserId(userId: string): Promise<Array<List>> {
        return this.lists.filter((l) => l.users.some((u) => u.id === userId));
    }
    async insert(list: List): Promise<void> {
        this.lists.push(list);
    }
    async deleteById(listId: string): Promise<void> {
        this.lists = this.lists.filter((l) => l.id !== listId);
    }
    async replaceIfUnchanged(listId: string, list: List): Promise<number | null> {
        const index = this.lists.findIndex((l) => l.id === listId || l === list);

        if (index === -1) return null;
        this.lists[index] = list;

        return (list.revision ?? 0) + 1;
    }
    async pushItem(listId: string, item: Item): Promise<void> {
        this.lists.find((l) => l.id === listId)?.items.push(item);
    }
    async setCategoryIfUnset(_listId: string, _itemId: string, _category: ItemCategory): Promise<boolean> {
        return false;
    }
    async removeMemberFromAll(): Promise<void> {}
    async deleteOwnedBy(): Promise<void> {}
    async removeMemberEverywhere(): Promise<void> {}
}

class SequentialIds implements IdGenerator {
    private n = 0;
    generate(): string {
        return `gen-${++this.n}`;
    }
}

const owner: User = { id: 'owner-1', username: 'owner' };
const member: User = { id: 'member-2', username: 'member' };
const friend: User = { id: 'friend-1', username: 'friend' };

// SAFETY: only the three FriendService methods ListService calls are implemented.
const friends = {
    areFriends: async (_a: string, b: string) => b === friend.id,
    friendIdsOf: async () => [friend.id],
    listFriends: async () => [friend],
} as unknown as FriendService;

const baseList = (overrides: Partial<List>): List => ({
    id: 'list-1',
    title: LIST_TITLE,
    dateAdded: new Date('2026-01-01'),
    listType: ListType.SHOPPING,
    ownerId: owner.id,
    users: [owner, member],
    items: [
        { id: 'item-1', name: ITEM_NAME, dateAdded: new Date('2026-01-01'), isSelected: false },
        { id: 'item-2', name: OTHER_ITEM_NAME, dateAdded: new Date('2026-01-01'), isSelected: true },
    ],
    ...overrides,
});

const when = new Date('2026-02-02');

type Operation = { name: string; run: (service: ListService) => Promise<unknown>; listId?: string };

// Each operation addresses the list by its title (the legacy reference), so a log line that echoes the reference
// back leaks the title; the id must be what identifies the list instead.
const successes: Array<Operation> = [
    {
        name: 'creating a list',
        run: (s) => s.addList(NEW_LIST_TITLE, when, owner, undefined, ListType.SHOPPING, 'new-list'),
    },
    {
        name: 'creating a list shared with chosen friends',
        run: (s) => s.addList(NEW_LIST_TITLE, when, owner, [friend.id], ListType.SHOPPING, 'new-list'),
    },
    {
        name: 'adding an item',
        run: (s) => s.addItem(LIST_TITLE, NEW_ITEM_NAME, when, 2, 'kg', owner),
        listId: 'list-1',
    },
    {
        name: 'renaming an item',
        run: (s) => s.updateItemName(LIST_TITLE, 'item-1', NEW_ITEM_NAME),
        listId: 'list-1',
    },
    { name: 'selecting an item', run: (s) => s.setItemSelected(LIST_TITLE, 'item-1', true), listId: 'list-1' },
    { name: 'changing a quantity', run: (s) => s.updateItemQuantity(LIST_TITLE, 'item-1', 3, 'kg'), listId: 'list-1' },
    {
        name: 'setting an item category',
        run: (s) => s.setItemCategory(LIST_TITLE, 'item-1', 'produce'),
        listId: 'list-1',
    },
    { name: 'deleting an item', run: (s) => s.deleteItem(LIST_TITLE, 'item-1'), listId: 'list-1' },
    { name: 'clearing selected items', run: (s) => s.clearSelectedItems(LIST_TITLE), listId: 'list-1' },
    { name: 'clearing a list', run: (s) => s.clearList(LIST_TITLE), listId: 'list-1' },
    { name: 'deleting a list', run: (s) => s.deleteList(LIST_TITLE), listId: 'list-1' },
    { name: 'renaming a list', run: (s) => s.updateListTitle(LIST_TITLE, NEW_LIST_TITLE), listId: 'list-1' },
    {
        name: 'adding items in bulk',
        run: (s) =>
            s.addItems(
                LIST_TITLE,
                [
                    { itemName: NEW_ITEM_NAME, quantity: 1, unit: 'kg', dateAdded: when },
                    { itemName: ITEM_NAME, dateAdded: when },
                ],
                owner.id,
                owner
            ),
        listId: 'list-1',
    },
    {
        name: 'joining through an invite',
        run: (s) => s.addInvitedUser(LIST_TITLE, { id: 'joiner-9', username: 'joiner' }, owner.id),
        listId: 'list-1',
    },
    {
        name: 'adding a friend to a list',
        run: (s) => s.addUserToList(LIST_TITLE, friend.id, owner.id),
        listId: 'list-1',
    },
    {
        name: 'removing a member from a list',
        run: (s) => s.removeUserFromList(LIST_TITLE, member.id, owner.id),
        listId: 'list-1',
    },
    { name: 'reading a legacy list without a type', run: (s) => s.getList(LEGACY_TITLE), listId: 'legacy-1' },
];

// Failures are addressed by id: the failure branches log whatever the caller handed in, and the user's own text
// (new names, new titles) still must not appear.
const failures: Array<Operation> = [
    {
        name: 'creating a duplicate list',
        run: (s) => s.addList(LIST_TITLE, when, owner, undefined, ListType.SHOPPING, 'dup'),
    },
    { name: 'adding a duplicate item', run: (s) => s.addItem('list-1', ITEM_NAME, when) },
    { name: 'renaming an item to its current name', run: (s) => s.updateItemName('list-1', 'item-1', ITEM_NAME) },
    { name: 'renaming an item to a clashing name', run: (s) => s.updateItemName('list-1', 'item-1', OTHER_ITEM_NAME) },
    { name: 'renaming a list to a clashing title', run: (s) => s.updateListTitle('list-1', CLASH_TITLE) },
];

describe('ListService logging', () => {
    let logger: RecordingLogger;
    let repo: MemoryListRepository;
    let service: ListService;

    beforeEach(() => {
        logger = new RecordingLogger();
        repo = new MemoryListRepository();
        repo.lists = [
            baseList({}),
            baseList({ id: 'list-2', title: CLASH_TITLE, items: [] }),
            baseList({ id: 'legacy-1', title: LEGACY_TITLE, listType: undefined, items: [] }),
        ];
        service = new ListService(
            repo,
            new SequentialIds(),
            logger as unknown as Logger,
            undefined,
            undefined,
            friends
        );
    });

    describe('When a user changes a list', () => {
        it.each(successes)('should log no list title or item name when $name', async ({ run, listId }) => {
            await run(service);

            expect(logger.entries.length).toBeGreaterThan(0);

            for (const sentinel of SENTINELS) {
                expect(logger.text()).not.toContain(sentinel);
            }

            if (listId) expect(logger.text()).toContain(listId);
        });
    });

    describe('When a change fails', () => {
        it.each(failures)('should log no list title or item name when $name', async ({ run }) => {
            await expect(run(service)).rejects.toBeDefined();

            expect(logger.entries.some((e) => e.level === 'error')).toBe(true);

            for (const sentinel of SENTINELS) {
                expect(logger.text()).not.toContain(sentinel);
            }
        });
    });
});
