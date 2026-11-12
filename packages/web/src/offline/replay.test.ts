import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { addRecipe, updateRecipe, createTodo } = vi.hoisted(() => ({
    addRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    createTodo: vi.fn(),
}));

vi.mock('../api', () => ({ addRecipe, updateRecipe, createTodo }));

import type { OutboxIntent } from './outboxStore';
import { replayIntent } from './replay';

const user = { id: 'u1', username: 'tester' };

const createIntent = (payload: Record<string, unknown>): OutboxIntent =>
    ({
        id: 'i1',
        seq: 1,
        entityType: 'recipe',
        op: 'recipe.create',
        targetId: 'r1',
        scope: '',
        payload: { title: 'Pancakes', user, ...payload },
        createdAt: 0,
    }) as OutboxIntent;

describe('replayIntent recipe.create', () => {
    beforeEach(() => addRecipe.mockReset());

    it('sends the tags the user entered along with the rest of the recipe', async () => {
        await replayIntent(createIntent({ tags: ['breakfast', 'quick'], servings: 4 }));

        expect(addRecipe).toHaveBeenCalledWith(
            'Pancakes',
            user,
            [],
            undefined,
            undefined,
            undefined,
            'r1',
            undefined,
            undefined,
            4,
            undefined,
            ['breakfast', 'quick']
        );
    });

    it('leaves tags undefined when none were entered', async () => {
        await replayIntent(createIntent({}));

        expect(addRecipe.mock.calls[0][11]).toBeUndefined();
    });
});

describe('replayIntent recipe.update', () => {
    beforeEach(() => updateRecipe.mockReset());

    it('sends edited tags, including after the details fields', async () => {
        await replayIntent({
            ...createIntent({ title: 'Pancakes', ingredients: [], prepTime: 5, tags: ['vegan'] }),
            op: 'recipe.update',
        });

        expect(updateRecipe).toHaveBeenCalledWith(
            'r1',
            'Pancakes',
            [],
            undefined,
            undefined,
            undefined,
            5,
            undefined,
            undefined,
            undefined,
            ['vegan']
        );
    });
});

describe('replayIntent todo.create', () => {
    it('keeps an empty share list so the todo is not shared with every friend', async () => {
        await replayIntent({
            ...createIntent({}),
            entityType: 'todo',
            op: 'todo.create',
            targetId: 't1',
            payload: { title: 'Private', ownerId: 'u1', userIds: [] },
        } as OutboxIntent);

        expect(createTodo).toHaveBeenCalledWith({ title: 'Private', ownerId: 'u1', userIds: [] }, 't1');
    });
});
