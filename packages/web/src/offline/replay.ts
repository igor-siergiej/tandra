import type { ItemCategory } from '@tandra/types';

import {
    addItem,
    addList,
    addRecipe,
    completeTodo,
    createLabel,
    createTodo,
    deleteItem,
    deleteLabel,
    deleteRecipe,
    deleteTodo,
    updateItem,
    updateItemCategory,
    updateItemName,
    updateItemQuantity,
    updateLabel,
    updateRecipe,
    updateTodo,
} from '../api';
import type { OutboxIntent } from './outboxStore';

// fallow-ignore-next-line complexity
export const replayIntent = async (intent: OutboxIntent): Promise<void> => {
    const p = intent.payload;
    switch (intent.op) {
        case 'item.add':
            await addItem(
                String(p.name),
                intent.scope,
                p.quantity as number | undefined,
                p.unit as string | undefined,
                intent.targetId
            );
            return;
        case 'item.delete':
            await deleteItem(intent.targetId, intent.scope);
            return;
        case 'item.toggle':
            await updateItem(intent.targetId, Boolean(p.isSelected), intent.scope);
            return;
        case 'item.rename':
            await updateItemName(intent.scope, intent.targetId, String(p.newItemName));
            return;
        case 'item.quantity':
            await updateItemQuantity(
                intent.scope,
                intent.targetId,
                p.quantity as number | undefined,
                p.unit as string | undefined
            );
            return;
        case 'item.category':
            await updateItemCategory(intent.scope, intent.targetId, p.category as ItemCategory);
            return;
        case 'list.create':
            await addList(
                String(p.title),
                p.user as Parameters<typeof addList>[1],
                (p.selectedUsers as string[] | undefined) ?? [],
                p.listType as Parameters<typeof addList>[3] | undefined,
                intent.targetId
            );
            return;
        case 'todo.create':
            await createTodo(intent.payload as Parameters<typeof createTodo>[0], intent.targetId);
            return;
        case 'todo.update':
            await updateTodo(intent.targetId, intent.payload as Parameters<typeof updateTodo>[1]);
            return;
        case 'todo.delete':
            await deleteTodo(intent.targetId);
            return;
        case 'todo.complete':
            await completeTodo(intent.targetId, intent.payload.date as string | undefined);
            return;
        case 'label.create':
            await createLabel(intent.payload as Parameters<typeof createLabel>[0], intent.targetId);
            return;
        case 'label.update':
            await updateLabel(intent.targetId, intent.payload as Parameters<typeof updateLabel>[1]);
            return;
        case 'label.delete':
            await deleteLabel(intent.targetId);
            return;
        case 'recipe.create': {
            await addRecipe(
                String(p.title),
                p.user as Parameters<typeof addRecipe>[1],
                (p.selectedUsers as string[] | undefined) ?? [],
                p.ingredients as Parameters<typeof addRecipe>[3] | undefined,
                p.link as string | undefined,
                p.instructions as string[] | undefined,
                intent.targetId,
                p.prepTime as number | undefined,
                p.cookTime as number | undefined,
                p.servings as number | undefined,
                p.difficulty as Parameters<typeof addRecipe>[10] | undefined,
                p.tags as string[] | undefined
            );
            return;
        }
        case 'recipe.update': {
            await updateRecipe(
                intent.targetId,
                String(p.title),
                p.ingredients as Parameters<typeof updateRecipe>[2],
                p.coverImageKey as string | undefined,
                p.link as string | undefined,
                p.instructions as string[] | undefined,
                p.prepTime as number | undefined,
                p.cookTime as number | undefined,
                p.servings as number | undefined,
                p.difficulty as Parameters<typeof updateRecipe>[9] | undefined,
                p.tags as string[] | undefined
            );
            return;
        }
        case 'recipe.delete':
            await deleteRecipe(intent.targetId);
            return;
    }
};
