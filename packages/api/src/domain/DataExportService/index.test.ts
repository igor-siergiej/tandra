import { describe, expect, it } from 'bun:test';

import type { Recipe, Todo } from '@tandra/types';

import { AuthorizationService } from '../AuthorizationService';
import { DataExportService, EXPORT_SCHEMA_VERSION } from './index';

const me = { id: 'me', username: 'igor' };
const them = { id: 'them', username: 'sam' };
const now = new Date('2030-02-03T10:00:00Z');

const service = (overrides: Partial<ConstructorParameters<typeof DataExportService>[0]> = {}) =>
    new DataExportService(
        {
            lists: {
                getListsForUser: async () => [
                    {
                        id: 'l1',
                        title: 'Mine',
                        dateAdded: now,
                        listType: 'shopping',
                        items: [
                            { id: 'i1', name: '  Oat  Milk ', isSelected: false, dateAdded: now, category: 'dairy' },
                            { id: 'i2', name: 'rope', isSelected: false, dateAdded: now },
                        ],
                        users: [{ username: 'igor' }],
                        ownerId: me.id,
                    },
                    {
                        id: 'l2',
                        title: 'Theirs',
                        dateAdded: now,
                        listType: 'shopping',
                        items: [{ id: 'i3', name: 'bread', isSelected: true, dateAdded: now, category: 'bakery' }],
                        users: [{ username: 'sam' }, { username: 'igor' }],
                        ownerId: them.id,
                    },
                ],
            },
            recipes: {
                getRecipesByUserId: async () =>
                    [
                        { id: 'r1', title: 'Soup', ingredients: [], users: [me], ownerId: me.id, dateAdded: now },
                        {
                            id: 'r2',
                            title: 'Stew',
                            ingredients: [],
                            users: [them, me],
                            ownerId: them.id,
                            coverImageKey: 'recipe-upload/them/r2/1.webp',
                            dateAdded: now,
                            _id: 'mongo-internal',
                        },
                    ] as Recipe[],
            },
            mealPlans: {
                listAllForUser: async () => [
                    { id: 'm1', ownerId: them.id, date: '2030-01-09', recipeId: 'r2', servings: 4, dateAdded: now },
                ],
            },
            todos: {
                getTodosForUser: async () =>
                    [
                        { id: 't1', ownerId: me.id, title: 'Mine', done: false, dateAdded: now, users: [them] },
                        { id: 't2', ownerId: them.id, title: 'Theirs', done: false, dateAdded: now },
                    ] as Todo[],
            },
            labels: { getLabelsByOwner: async () => [{ id: 'b1', ownerId: me.id, name: 'Health', color: '#f00' }] },
            friends: { listFriends: async () => [them] },
            ...overrides,
        },
        new AuthorizationService()
    );

describe('DataExportService', () => {
    it('marks owned and shared-with-me data on every kind that can be shared', async () => {
        const data = await service().exportFor(me, now);

        expect(data.lists.map((l) => [l.title, l.ownership])).toEqual([
            ['Mine', 'owned'],
            ['Theirs', 'shared'],
        ]);
        expect(data.recipes.map((r) => [r.title, r.ownership])).toEqual([
            ['Soup', 'owned'],
            ['Stew', 'shared'],
        ]);
        expect(data.todos.map((t) => [t.title, t.ownership])).toEqual([
            ['Mine', 'owned'],
            ['Theirs', 'shared'],
        ]);
        expect(data.mealPlans.map((m) => m.ownership)).toEqual(['shared']);
    });

    it('describes the file in meta, including what is left out', async () => {
        const { meta } = await service().exportFor(me, now);

        expect(meta.exportedAt).toBe('2030-02-03T10:00:00.000Z');
        expect(meta.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
        expect(meta.omitted.some((entry) => /image/i.test(entry))).toBe(true);
    });

    it('references images by key and keeps other accounts and Mongo internals out', async () => {
        const data = await service().exportFor(me, now);
        const stew = data.recipes[1] as unknown as Record<string, unknown>;

        expect(stew.coverImageKey).toBe('recipe-upload/them/r2/1.webp');
        expect(stew.users).toEqual(['sam', 'igor']);
        expect(stew).not.toHaveProperty('_id');
        expect(stew).not.toHaveProperty('ownerId');
        expect(JSON.stringify(data)).not.toContain('"them"');
    });

    it('lists friends by username, labels without their owner, and the aisle of each listed item by normalised name', async () => {
        const data = await service().exportFor(me, now);

        expect(data.friends).toEqual(['sam']);
        expect(data.labels).toEqual([{ id: 'b1', name: 'Health', color: '#f00' }]);
        expect(data.itemCategories).toEqual({ 'oat milk': 'dairy', bread: 'bakery' });
    });

    it('exports empty collections for a user with no data', async () => {
        const data = await service({
            lists: { getListsForUser: async () => [] },
            recipes: { getRecipesByUserId: async () => [] },
            mealPlans: { listAllForUser: async () => [] },
            todos: { getTodosForUser: async () => [] },
            labels: { getLabelsByOwner: async () => [] },
            friends: { listFriends: async () => [] },
        }).exportFor(me, now);

        expect(data).toMatchObject({
            lists: [],
            recipes: [],
            mealPlans: [],
            todos: [],
            labels: [],
            itemCategories: {},
            friends: [],
        });
    });
});
