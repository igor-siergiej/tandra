import { describe, expect, it } from 'vitest';

import { applyItemIntent, applyLabelIntent, applyListIntent, applyRecipeIntent, applyTodoIntent } from './intents';
import type { OutboxIntent } from './outboxStore';

const base = (op: OutboxIntent['op'], targetId: string, payload = {}): OutboxIntent => ({
    seq: 1,
    id: 'i',
    entityType: 'item',
    op,
    targetId,
    scope: 'L',
    payload,
    createdAt: 0,
});

const items = [{ id: 'a', name: 'Milk', isSelected: false }];

describe('applyItemIntent', () => {
    it('toggle sets isSelected by id', () => {
        expect(applyItemIntent(items, base('item.toggle', 'a', { isSelected: true }))[0].isSelected).toBe(true);
    });
    it('delete removes by id', () => {
        expect(applyItemIntent(items, base('item.delete', 'a'))).toHaveLength(0);
    });
    it('rename changes name by id', () => {
        expect(applyItemIntent(items, base('item.rename', 'a', { newItemName: 'Oat Milk' }))[0].name).toBe('Oat Milk');
    });
    it('quantity merges fields by id', () => {
        const r = applyItemIntent(items, base('item.quantity', 'a', { quantity: 2, unit: 'L' }))[0];
        expect(r.quantity).toBe(2);
        expect(r.unit).toBe('L');
    });
    it('category sets the aisle by id', () => {
        expect(applyItemIntent(items, base('item.category', 'a', { category: 'dairy' }))[0].category).toBe('dairy');
    });
    it('add appends a new item when absent', () => {
        const r = applyItemIntent(items, base('item.add', 'b', { name: 'Bread' }));
        expect(r.map((i) => i.id)).toEqual(['a', 'b']);
    });
    it('add is idempotent when id already present', () => {
        const r = applyItemIntent(items, base('item.add', 'a', { name: 'Milk' }));
        expect(r).toHaveLength(1);
    });
});

const listBase = (targetId: string, payload = {}): OutboxIntent => ({
    seq: 1,
    id: 'i',
    entityType: 'list',
    op: 'list.create',
    targetId,
    scope: 'user-1',
    payload,
    createdAt: 0,
});

describe('applyListIntent', () => {
    it('list.create appends a new list', () => {
        const r = applyListIntent([], listBase('L1', { title: 'Groceries', listType: 'shopping', ownerId: 'user-1' }));
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({
            id: 'L1',
            title: 'Groceries',
            items: [],
            listType: 'shopping',
            ownerId: 'user-1',
        });
    });
    it('list.create is idempotent when id already present', () => {
        const existing = [{ id: 'L1', title: 'Groceries', items: [], users: [], listType: 'shopping' }];
        expect(applyListIntent(existing, listBase('L1', { title: 'Groceries' }))).toHaveLength(1);
    });
});

const todoIntent = (op: OutboxIntent['op'], targetId: string, payload = {}): OutboxIntent => ({
    seq: 1,
    id: 'i',
    entityType: 'todo',
    op,
    targetId,
    scope: 'user-1',
    payload,
    createdAt: 0,
});

describe('applyTodoIntent', () => {
    it('todo.create appends a new todo', () => {
        const r = applyTodoIntent([], todoIntent('todo.create', 'T1', { title: 'Buy milk', ownerId: 'user-1' }));
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({ id: 'T1', title: 'Buy milk', done: false, ownerId: 'user-1' });
    });
    it('todo.create is idempotent when id already present', () => {
        const existing = [{ id: 'T1', ownerId: 'user-1', title: 'Buy milk', done: false, dateAdded: new Date() }];
        expect(applyTodoIntent(existing as never, todoIntent('todo.create', 'T1', { title: 'x' }))).toHaveLength(1);
    });
    it('todo.update merges fields by id', () => {
        const existing = [{ id: 'T1', ownerId: 'user-1', title: 'Buy milk', done: false, dateAdded: new Date() }];
        const r = applyTodoIntent(existing as never, todoIntent('todo.update', 'T1', { title: 'Buy oat milk' }));
        expect(r[0].title).toBe('Buy oat milk');
    });
    it('todo.delete removes by id', () => {
        const existing = [{ id: 'T1', ownerId: 'user-1', title: 'Buy milk', done: false, dateAdded: new Date() }];
        expect(applyTodoIntent(existing as never, todoIntent('todo.delete', 'T1'))).toHaveLength(0);
    });
    it('todo.complete toggles done for a non-recurring todo', () => {
        const existing = [{ id: 'T1', ownerId: 'user-1', title: 'Buy milk', done: false, dateAdded: new Date() }];
        expect(applyTodoIntent(existing as never, todoIntent('todo.complete', 'T1'))[0].done).toBe(true);
    });
});

const labelIntent = (op: OutboxIntent['op'], targetId: string, payload = {}): OutboxIntent => ({
    seq: 1,
    id: 'i',
    entityType: 'label',
    op,
    targetId,
    scope: 'user-1',
    payload,
    createdAt: 0,
});

describe('applyLabelIntent', () => {
    it('label.create appends a new label', () => {
        const r = applyLabelIntent(
            [],
            labelIntent('label.create', 'L1', { name: 'Home', color: '#fff', ownerId: 'user-1' })
        );
        expect(r[0]).toMatchObject({ id: 'L1', name: 'Home', color: '#fff', ownerId: 'user-1' });
    });
    it('label.update merges fields by id', () => {
        const existing = [{ id: 'L1', ownerId: 'user-1', name: 'Home', color: '#fff' }];
        expect(applyLabelIntent(existing as never, labelIntent('label.update', 'L1', { color: '#000' }))[0].color).toBe(
            '#000'
        );
    });
    it('label.delete removes by id', () => {
        const existing = [{ id: 'L1', ownerId: 'user-1', name: 'Home', color: '#fff' }];
        expect(applyLabelIntent(existing as never, labelIntent('label.delete', 'L1'))).toHaveLength(0);
    });
});

const recipeIntent = (op: OutboxIntent['op'], targetId: string, payload = {}): OutboxIntent => ({
    seq: 1,
    id: 'i',
    entityType: 'recipe',
    op,
    targetId,
    scope: 'user-1',
    payload,
    createdAt: 0,
});

describe('applyRecipeIntent', () => {
    it('recipe.create appends a text-only recipe', () => {
        const r = applyRecipeIntent([], recipeIntent('recipe.create', 'R1', { title: 'Pasta', ownerId: 'user-1' }));
        expect(r[0]).toMatchObject({ id: 'R1', title: 'Pasta', ownerId: 'user-1' });
        expect(Array.isArray(r[0].ingredients)).toBe(true);
    });
    it('recipe.update merges title by id', () => {
        const existing = [
            { id: 'R1', title: 'Pasta', ingredients: [], ownerId: 'user-1', users: [], dateAdded: new Date() },
        ];
        expect(
            applyRecipeIntent(existing as never, recipeIntent('recipe.update', 'R1', { title: 'Risotto' }))[0].title
        ).toBe('Risotto');
    });
    it('recipe.create carries tags through', () => {
        const r = applyRecipeIntent(
            [],
            recipeIntent('recipe.create', 'R1', { title: 'Pasta', ownerId: 'user-1', tags: ['dinner', 'quick'] })
        );
        expect(r[0].tags).toEqual(['dinner', 'quick']);
    });
    it('recipe.update merges tags by id', () => {
        const existing = [
            {
                id: 'R1',
                title: 'Pasta',
                ingredients: [],
                ownerId: 'user-1',
                users: [],
                dateAdded: new Date(),
                tags: ['dinner'],
            },
        ];
        expect(
            applyRecipeIntent(existing as never, recipeIntent('recipe.update', 'R1', { tags: ['dinner', 'quick'] }))[0]
                .tags
        ).toEqual(['dinner', 'quick']);
    });
    it('recipe.create carries prepTime, cookTime, servings and difficulty through', () => {
        const r = applyRecipeIntent(
            [],
            recipeIntent('recipe.create', 'R1', {
                title: 'Pasta',
                ownerId: 'user-1',
                prepTime: 10,
                cookTime: 20,
                servings: 4,
                difficulty: 'easy',
            })
        );
        expect(r[0]).toMatchObject({ prepTime: 10, cookTime: 20, servings: 4, difficulty: 'easy' });
    });
    it('recipe.update merges prepTime, cookTime, servings and difficulty by id', () => {
        const existing = [
            { id: 'R1', title: 'Pasta', ingredients: [], ownerId: 'user-1', users: [], dateAdded: new Date() },
        ];
        const updated = applyRecipeIntent(
            existing as never,
            recipeIntent('recipe.update', 'R1', { prepTime: 15, cookTime: 25, servings: 6, difficulty: 'hard' })
        )[0];
        expect(updated).toMatchObject({ prepTime: 15, cookTime: 25, servings: 6, difficulty: 'hard' });
    });
    it('recipe.delete removes by id', () => {
        const existing = [
            { id: 'R1', title: 'Pasta', ingredients: [], ownerId: 'user-1', users: [], dateAdded: new Date() },
        ];
        expect(applyRecipeIntent(existing as never, recipeIntent('recipe.delete', 'R1'))).toHaveLength(0);
    });
});
