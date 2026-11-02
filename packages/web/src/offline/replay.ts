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
// An intent the server would have answered 400 to: the drainer treats a 4xx as final and drops it.
const malformed = (op: OutboxIntent['op'], field: string) =>
    Object.assign(new Error(`${op} intent has no ${field}`), { status: 400 });

export const replayIntent = async (intent: OutboxIntent): Promise<void> => {
    const p = intent.payload;

    switch (intent.op) {
        case 'item.add':
            await addItem(String(p.name), intent.scope, p.quantity, p.unit, intent.targetId);

            return;
        case 'item.delete':
            await deleteItem(intent.targetId, intent.scope);

            return;
        case 'item.toggle':
            await updateItem(intent.targetId, p.isSelected === true, intent.scope);

            return;
        case 'item.rename':
            await updateItemName(intent.scope, intent.targetId, String(p.newItemName));

            return;
        case 'item.quantity':
            await updateItemQuantity(intent.scope, intent.targetId, p.quantity, p.unit);

            return;
        case 'item.category':
            if (p.category === undefined) throw malformed(intent.op, 'category');
            await updateItemCategory(intent.scope, intent.targetId, p.category);

            return;
        case 'list.create':
            if (!p.user) throw malformed(intent.op, 'user');
            await addList(String(p.title), p.user, p.selectedUsers ?? [], p.listType, intent.targetId);

            return;
        case 'todo.create':
            await createTodo({ ...p, title: p.title ?? '' }, intent.targetId);

            return;
        case 'todo.update':
            await updateTodo(intent.targetId, p);

            return;
        case 'todo.delete':
            await deleteTodo(intent.targetId);

            return;
        case 'todo.complete':
            await completeTodo(intent.targetId, p.date);

            return;
        case 'label.create':
            await createLabel({ ...p, name: p.name ?? '', color: p.color ?? '' }, intent.targetId);

            return;
        case 'label.update':
            await updateLabel(intent.targetId, p);

            return;
        case 'label.delete':
            await deleteLabel(intent.targetId);

            return;
        case 'recipe.create': {
            if (!p.user) throw malformed(intent.op, 'user');
            await addRecipe(
                String(p.title),
                p.user,
                p.selectedUsers ?? [],
                p.ingredients,
                p.link,
                p.instructions,
                intent.targetId,
                p.prepTime,
                p.cookTime,
                p.servings,
                p.difficulty,
                p.tags
            );

            return;
        }

        case 'recipe.update': {
            if (!p.ingredients) throw malformed(intent.op, 'ingredients');
            await updateRecipe(
                intent.targetId,
                String(p.title),
                p.ingredients,
                p.coverImageKey,
                p.link,
                p.instructions,
                p.prepTime,
                p.cookTime,
                p.servings,
                p.difficulty,
                p.tags
            );

            return;
        }

        case 'recipe.delete':
            await deleteRecipe(intent.targetId);

            return;
    }
};
