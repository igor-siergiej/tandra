import type { Ingredient, ItemCategory, ListType, Recipe, Todo, User } from '@tandra/types';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

export type ItemOp = 'item.add' | 'item.toggle' | 'item.delete' | 'item.rename' | 'item.quantity' | 'item.category';

export type ListOp = 'list.create';

export type TodoOp = 'todo.create' | 'todo.update' | 'todo.delete' | 'todo.complete';

export type LabelOp = 'label.create' | 'label.update' | 'label.delete';

export type RecipeOp = 'recipe.create' | 'recipe.update' | 'recipe.delete';

export type EntityType = 'item' | 'list' | 'todo' | 'label' | 'recipe';

type TodoClearField = 'dueDate' | 'time' | 'labelId' | 'recurrence';

/**
 * Everything an outbox intent can carry. Each op reads the handful of fields it needs, so the keys are
 * shared across ops and all optional; replay and the optimistic folds never need to guess a field's type.
 */
export interface OutboxPayload extends Partial<
    Pick<Todo, 'done' | 'completedDates' | 'dueDate' | 'labelId' | 'ownerId' | 'recurrence' | 'time'>
> {
    // items
    name?: string;
    newItemName?: string;
    isSelected?: boolean;
    quantity?: number;
    unit?: string;
    category?: ItemCategory;
    // lists, todos, recipes
    title?: string;
    listType?: ListType;
    selectedUsers?: string[];
    user?: User;
    users?: User[];
    userIds?: string[];
    // todos
    date?: string;
    clear?: TodoClearField[];
    // labels
    color?: string;
    // recipes
    ingredients?: Array<Omit<Ingredient, 'id'> & { id?: string }>;
    coverImageKey?: string;
    link?: string;
    instructions?: string[];
    tags?: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: Recipe['difficulty'];
}

export interface OutboxIntent {
    seq: number;
    id: string;
    entityType: EntityType;
    op: ItemOp | ListOp | TodoOp | LabelOp | RecipeOp;
    targetId: string;
    scope: string;
    payload: OutboxPayload;
    createdAt: number;
}

interface OutboxDB extends DBSchema {
    intents: { key: number; value: OutboxIntent };
}

const DB_NAME = 'tandra-outbox';
const STORE = 'intents';

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<OutboxDB>(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
            },
        });
    }

    return dbPromise;
};

let mirror: OutboxIntent[] = [];
const listeners = new Set<() => void>();

const notify = () => {
    for (const cb of listeners) cb();
};

const sortBySeq = (a: OutboxIntent, b: OutboxIntent) => a.seq - b.seq;

export const outboxStore = {
    async hydrate() {
        const db = await getDB();
        mirror = (await db.getAll(STORE)).sort(sortBySeq);
        notify();
    },
    async enqueue(intent: Omit<OutboxIntent, 'seq'>) {
        const db = await getDB();
        // The store auto-increments `seq`, so the record is written without one and gets it back from add().
        // SAFETY: `seq` is the object store's keyPath with autoIncrement; IndexedDB assigns it on add, so the intent is complete once stored.
        const seq = await db.add(STORE, intent as OutboxIntent);
        const stored: OutboxIntent = { ...intent, seq };
        mirror = [...mirror, stored].sort(sortBySeq);
        notify();

        return stored;
    },
    peekAll() {
        return mirror;
    },
    async remove(seq: number) {
        const db = await getDB();
        await db.delete(STORE, seq);
        mirror = mirror.filter((i) => i.seq !== seq);
        notify();
    },
    count() {
        return mirror.length;
    },
    subscribe(cb: () => void) {
        listeners.add(cb);

        return () => listeners.delete(cb);
    },
    async clear() {
        const db = await getDB();
        await db.clear(STORE);
        mirror = [];
        notify();
    },
    async _resetForTests() {
        const db = await getDB();
        await db.clear(STORE);
        mirror = [];
        notify();
    },
};
