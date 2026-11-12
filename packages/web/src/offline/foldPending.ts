import type { Item, Label, ListResponse, ListType, Recipe, Todo, User } from '@tandra/types';

import {
    applyItemIntent,
    applyLabelIntent,
    applyListIntent,
    applyRecipeIntent,
    applyTodoIntent,
    type ItemView,
    type ListView,
} from './intents';
import { outboxStore } from './outboxStore';

export interface ListItemsData {
    title?: string;
    listType: ListType;
    items: Item[];
    users: Array<{ id: string; username: string }> | User[];
    ownerId?: string;
}

export const foldPendingItems = (listTitle: string, data: ListItemsData): ListItemsData => {
    const pending = outboxStore.peekAll().filter((i) => i.entityType === 'item' && i.scope === listTitle);

    if (pending.length === 0) return data;

    const items = pending.reduce<ItemView[]>(
        (acc, intent) => applyItemIntent(acc, intent),
        data.items as unknown as ItemView[]
    );

    return { ...data, items: items as unknown as Item[] };
};

export const foldPendingLists = (userId: string, lists: ListResponse[]): ListResponse[] => {
    const pending = outboxStore.peekAll().filter((i) => i.entityType === 'list' && i.scope === userId);

    if (pending.length === 0) return lists;

    const folded = pending.reduce<ListView[]>(
        (acc, intent) => applyListIntent(acc, intent),
        lists as unknown as ListView[]
    );

    return folded as unknown as ListResponse[];
};

export const foldPendingTodos = (userId: string, todos: Todo[]): Todo[] => {
    const pending = outboxStore.peekAll().filter((i) => i.entityType === 'todo' && i.scope === userId);

    if (pending.length === 0) return todos;

    return pending.reduce<Todo[]>((acc, intent) => applyTodoIntent(acc, intent), todos);
};

export const foldPendingLabels = (userId: string, labels: Label[]): Label[] => {
    const pending = outboxStore.peekAll().filter((i) => i.entityType === 'label' && i.scope === userId);

    if (pending.length === 0) return labels;

    return pending.reduce<Label[]>((acc, intent) => applyLabelIntent(acc, intent), labels);
};

export const foldPendingRecipes = (userId: string, recipes: Recipe[]): Recipe[] => {
    const pending = outboxStore.peekAll().filter((i) => i.entityType === 'recipe' && i.scope === userId);

    if (pending.length === 0) return recipes;

    return pending.reduce<Recipe[]>((acc, intent) => applyRecipeIntent(acc, intent), recipes);
};

// Single-recipe fold for the detail query: re-applies this recipe's pending intents over
// fresh server data so an optimistic edit survives a refetch before the outbox has drained.
export const foldPendingRecipe = (recipeId: string, recipe: Recipe): Recipe => {
    const pending = outboxStore.peekAll().filter((i) => i.entityType === 'recipe' && i.targetId === recipeId);

    if (pending.length === 0) return recipe;
    const folded = pending.reduce<Recipe[]>((acc, intent) => applyRecipeIntent(acc, intent), [recipe]);

    return folded[0] ?? recipe;
};
