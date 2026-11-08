import 'fake-indexeddb/auto';
import { type ListResponse, ListType } from '@tandra/types';
import { beforeEach, describe, expect, it } from 'vitest';

import { fake } from '../testing/fake';
import {
    foldPendingItems,
    foldPendingLabels,
    foldPendingLists,
    foldPendingRecipe,
    foldPendingRecipes,
    foldPendingTodos,
    type ListItemsData,
} from './foldPending';
import { outboxStore } from './outboxStore';

describe('foldPendingItems', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('applies pending intents for the given list over server data', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'item',
            op: 'item.toggle',
            targetId: 'a',
            scope: 'L',
            payload: { isSelected: true },
            createdAt: 0,
        });
        await outboxStore.enqueue({
            id: '2',
            entityType: 'item',
            op: 'item.add',
            targetId: 'b',
            scope: 'L',
            payload: { name: 'Bread' },
            createdAt: 0,
        });

        const server: ListItemsData = {
            listType: ListType.SHOPPING,
            items: [{ id: 'a', name: 'Milk', isSelected: false, dateAdded: new Date(0) }],
            users: [],
        };

        const folded = foldPendingItems('L', server);
        expect(folded.items.find((i) => i.id === 'a')?.isSelected).toBe(true);
        expect(folded.items.map((i) => i.id)).toEqual(['a', 'b']);
    });

    it('ignores intents scoped to other lists', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'item',
            op: 'item.delete',
            targetId: 'a',
            scope: 'OTHER',
            payload: {},
            createdAt: 0,
        });

        const server: ListItemsData = {
            listType: ListType.SHOPPING,
            items: [{ id: 'a', name: 'Milk', isSelected: false, dateAdded: new Date(0) }],
            users: [],
        };

        expect(foldPendingItems('L', server).items).toHaveLength(1);
    });
});

describe('foldPendingLists', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });

    it('appends pending list.create for the given user', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'list',
            op: 'list.create',
            targetId: 'L1',
            scope: 'user-1',
            payload: { title: 'Groceries', listType: ListType.SHOPPING, ownerId: 'user-1' },
            createdAt: 0,
        });

        const server: ListResponse[] = [
            { id: 'S1', title: 'Existing', dateAdded: new Date(), items: [], users: [], listType: ListType.SHOPPING },
        ];

        const folded = foldPendingLists('user-1', server);
        expect(folded.map((l) => l.id)).toEqual(['S1', 'L1']);
    });

    it('ignores list.create scoped to a different user', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'list',
            op: 'list.create',
            targetId: 'L1',
            scope: 'user-2',
            payload: { title: 'X' },
            createdAt: 0,
        });

        const server: ListResponse[] = [
            { id: 'S1', title: 'Existing', dateAdded: new Date(), items: [], users: [], listType: ListType.SHOPPING },
        ];

        expect(foldPendingLists('user-1', server)).toHaveLength(1);
    });
});

describe('foldPendingTodos', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });
    it('appends pending todo.create for the given user', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'todo',
            op: 'todo.create',
            targetId: 'T1',
            scope: 'user-1',
            payload: { title: 'Buy milk', ownerId: 'user-1' },
            createdAt: 0,
        });
        const server = [{ id: 'S1', ownerId: 'user-1', title: 'Existing', done: false, dateAdded: new Date() }];
        expect(foldPendingTodos('user-1', fake(server)).map((t) => t.id)).toEqual(['S1', 'T1']);
    });
    it('ignores todo intents scoped to another user', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'todo',
            op: 'todo.create',
            targetId: 'T1',
            scope: 'user-2',
            payload: { title: 'x' },
            createdAt: 0,
        });
        const server = [{ id: 'S1', ownerId: 'user-1', title: 'Existing', done: false, dateAdded: new Date() }];
        expect(foldPendingTodos('user-1', fake(server))).toHaveLength(1);
    });
});

describe('foldPendingLabels', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });
    it('appends pending label.create for the given user', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'label',
            op: 'label.create',
            targetId: 'L1',
            scope: 'user-1',
            payload: { name: 'Home', color: '#fff', ownerId: 'user-1' },
            createdAt: 0,
        });
        const server = [{ id: 'S1', ownerId: 'user-1', name: 'Work', color: '#000' }];
        expect(foldPendingLabels('user-1', fake(server)).map((l) => l.id)).toEqual(['S1', 'L1']);
    });
});

describe('foldPendingRecipes', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });
    it('appends pending recipe.create for the given user', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'recipe',
            op: 'recipe.create',
            targetId: 'R1',
            scope: 'user-1',
            payload: { title: 'Pasta', ownerId: 'user-1' },
            createdAt: 0,
        });

        const server = [
            { id: 'S1', title: 'Soup', ingredients: [], ownerId: 'user-1', users: [], dateAdded: new Date() },
        ];

        expect(foldPendingRecipes('user-1', fake(server)).map((r) => r.id)).toEqual(['S1', 'R1']);
    });
});

describe('foldPendingRecipe', () => {
    beforeEach(async () => {
        await outboxStore._resetForTests();
    });
    it('re-applies a pending recipe.update over fresh server data for that recipe', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'recipe',
            op: 'recipe.update',
            targetId: 'R1',
            scope: 'user-1',
            payload: { title: 'New Title' },
            createdAt: 0,
        });

        const server = {
            id: 'R1',
            title: 'Old Title',
            ingredients: [],
            ownerId: 'user-1',
            users: [],
            dateAdded: new Date(),
        };

        expect(foldPendingRecipe('R1', fake(server)).title).toBe('New Title');
    });
    it('returns the recipe unchanged when no pending intent targets it', async () => {
        await outboxStore.enqueue({
            id: '1',
            entityType: 'recipe',
            op: 'recipe.update',
            targetId: 'OTHER',
            scope: 'user-1',
            payload: { title: 'Nope' },
            createdAt: 0,
        });

        const server = {
            id: 'R1',
            title: 'Old Title',
            ingredients: [],
            ownerId: 'user-1',
            users: [],
            dateAdded: new Date(),
        };

        expect(foldPendingRecipe('R1', fake(server)).title).toBe('Old Title');
    });
});
