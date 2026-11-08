import type { ItemCategory, Label, Recipe, Todo } from '@tandra/types';

import type { OutboxIntent, OutboxPayload } from './outboxStore';

export interface ItemView {
    id: string;
    name: string;
    isSelected: boolean;
    quantity?: number;
    unit?: string;
    category?: ItemCategory;
    dateAdded?: string | Date;
}

// One switch per outbox op, each a small literal merge; splitting further would scatter one intent type.
// fallow-ignore-next-line complexity
export const applyItemIntent = (items: ItemView[], intent: OutboxIntent): ItemView[] => {
    const p = intent.payload;

    switch (intent.op) {
        case 'item.add': {
            if (items.some((i) => i.id === intent.targetId)) return items;

            return [
                ...items,
                {
                    id: intent.targetId,
                    name: p.name ?? '',
                    isSelected: false,
                    ...(p.quantity !== undefined && { quantity: p.quantity }),
                    ...(p.unit !== undefined && { unit: p.unit }),
                },
            ];
        }

        case 'item.delete':
            return items.filter((i) => i.id !== intent.targetId);
        case 'item.toggle':
            return items.map((i) => (i.id === intent.targetId ? { ...i, isSelected: p.isSelected === true } : i));
        case 'item.rename':
            return items.map((i) => (i.id === intent.targetId ? { ...i, name: p.newItemName ?? '' } : i));
        case 'item.quantity':
            return items.map((i) =>
                i.id === intent.targetId
                    ? {
                          ...i,
                          ...(p.quantity !== undefined && { quantity: p.quantity }),
                          ...(p.unit !== undefined && { unit: p.unit }),
                      }
                    : i
            );
        case 'item.category':
            return items.map((i) => (i.id === intent.targetId ? { ...i, category: p.category } : i));
        default:
            return items;
    }
};

export interface ListView {
    id: string;
    title: string;
    items: unknown[];
    users: Array<{ id: string; username: string }>;
    listType: string;
    ownerId?: string;
    dateAdded?: string | Date;
}

// fallow-ignore-next-line complexity
export const applyListIntent = (lists: ListView[], intent: OutboxIntent): ListView[] => {
    const p = intent.payload;

    if (intent.op === 'list.create') {
        if (lists.some((l) => l.id === intent.targetId)) return lists;

        return [
            ...lists,
            {
                id: intent.targetId,
                title: p.title ?? '',
                items: [],
                users: p.users ?? [],
                listType: p.listType ?? 'shopping',
                ...(p.ownerId !== undefined && { ownerId: p.ownerId }),
                dateAdded: new Date(),
            },
        ];
    }

    return lists;
};

// fallow-ignore-next-line complexity
const applyTodoUpdate = (todo: Todo, payload: OutboxPayload): Todo => {
    const { clear, ...changes } = payload;
    const next: Todo = { ...todo, ...changes };

    for (const field of clear ?? []) delete next[field];

    return next;
};

// fallow-ignore-next-line complexity
const newTodo = (id: string, p: OutboxPayload): Todo => ({
    id,
    ownerId: p.ownerId ?? '',
    title: p.title ?? '',
    done: false,
    dateAdded: new Date(),
    ...(p.dueDate !== undefined && { dueDate: p.dueDate }),
    ...(p.time !== undefined && { time: p.time }),
    ...(p.labelId !== undefined && { labelId: p.labelId }),
    ...(p.recurrence !== undefined && { recurrence: p.recurrence, completedDates: [] }),
});

// fallow-ignore-next-line complexity
export const applyTodoIntent = (todos: Todo[], intent: OutboxIntent): Todo[] => {
    const p = intent.payload;

    switch (intent.op) {
        case 'todo.create':
            return todos.some((t) => t.id === intent.targetId) ? todos : [...todos, newTodo(intent.targetId, p)];
        case 'todo.update':
            return todos.map((t) => (t.id === intent.targetId ? applyTodoUpdate(t, p) : t));
        case 'todo.delete':
            return todos.filter((t) => t.id !== intent.targetId);
        case 'todo.complete':
            // fallow-ignore-next-line complexity
            return todos.map((t) => {
                if (t.id !== intent.targetId) return t;
                const { date } = p;

                if (t.recurrence && date) {
                    const current = t.completedDates ?? [];

                    const completedDates = current.includes(date)
                        ? current.filter((d) => d !== date)
                        : [...current, date];

                    return { ...t, completedDates };
                }

                return { ...t, done: !t.done };
            });
        default:
            return todos;
    }
};

// fallow-ignore-next-line complexity
export const applyLabelIntent = (labels: Label[], intent: OutboxIntent): Label[] => {
    const p = intent.payload;

    switch (intent.op) {
        case 'label.create': {
            if (labels.some((l) => l.id === intent.targetId)) return labels;

            return [
                ...labels,
                {
                    id: intent.targetId,
                    ownerId: p.ownerId ?? '',
                    name: p.name ?? '',
                    color: p.color ?? '',
                },
            ];
        }

        case 'label.update':
            return labels.map((l) =>
                l.id === intent.targetId
                    ? {
                          ...l,
                          ...(p.name !== undefined && { name: p.name }),
                          ...(p.color !== undefined && { color: p.color }),
                      }
                    : l
            );
        case 'label.delete':
            return labels.filter((l) => l.id !== intent.targetId);
        default:
            return labels;
    }
};

// Optional Recipe fields shared between recipe.create and recipe.update payloads — both branches
// merge the same subset onto a base object, so building it once keeps them from drifting apart.
// fallow-ignore-next-line complexity
const optionalRecipeFields = (p: OutboxPayload) => ({
    ...(p.link !== undefined && { link: p.link }),
    ...(p.instructions !== undefined && { instructions: p.instructions }),
    ...(p.tags !== undefined && { tags: p.tags }),
    ...(p.prepTime !== undefined && { prepTime: p.prepTime }),
    ...(p.cookTime !== undefined && { cookTime: p.cookTime }),
    ...(p.servings !== undefined && { servings: p.servings }),
    ...(p.difficulty !== undefined && { difficulty: p.difficulty }),
});

// fallow-ignore-next-line complexity
export const applyRecipeIntent = (recipes: Recipe[], intent: OutboxIntent): Recipe[] => {
    const p = intent.payload;

    switch (intent.op) {
        case 'recipe.create': {
            if (recipes.some((r) => r.id === intent.targetId)) return recipes;
            const rawIngredients = p.ingredients ?? [];

            return [
                ...recipes,
                {
                    id: intent.targetId,
                    title: p.title ?? '',
                    ingredients: rawIngredients.map((ing) => ({ ...ing, id: crypto.randomUUID() })),
                    ownerId: p.ownerId ?? '',
                    users: p.users ?? [],
                    dateAdded: new Date(),
                    ...optionalRecipeFields(p),
                },
            ];
        }

        case 'recipe.update':
            // fallow-ignore-next-line complexity
            return recipes.map((r) =>
                r.id === intent.targetId
                    ? {
                          ...r,
                          ...(p.title !== undefined && { title: p.title }),
                          ...(p.ingredients !== undefined && {
                              ingredients: p.ingredients.map((ing) => ({ ...ing, id: ing.id ?? crypto.randomUUID() })),
                          }),
                          ...optionalRecipeFields(p),
                      }
                    : r
            );
        case 'recipe.delete':
            return recipes.filter((r) => r.id !== intent.targetId);
        default:
            return recipes;
    }
};
