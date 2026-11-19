import type { Item, ItemCategory, Label, MealPlanEntry, Recipe, Todo, User } from '@tandra/types';

import type { AuthorizationService } from '../AuthorizationService';

/** Bumped when the shape of the export file changes, so a reader can tell which layout it holds. */
export const EXPORT_SCHEMA_VERSION = 1;

/** What the export deliberately leaves out, stated in the file itself so nobody has to guess. */
export const EXPORT_OMITTED: readonly string[] = [
    'Images: recipe images are referenced by their storage key (coverImageKey, aiImageKey), never embedded.',
    'Account credentials: password hash, sessions and linked sign-in accounts.',
    'Push notification subscriptions and pending friend codes or list invites.',
    'Recipes you published to Discover, and reports made about Discover recipes.',
    'The shared item-to-aisle cache; itemCategories only holds the aisles of items on your lists.',
];

export type Ownership = 'owned' | 'shared';

type Marked<T> = T & { ownership: Ownership };

export type ExportedList = Marked<{
    id: string;
    title: string;
    dateAdded: Date;
    listType: string;
    items: Item[];
    users: string[];
}>;

export type ExportedRecipe = Marked<Omit<Recipe, 'users' | 'ownerId'> & { users: string[] }>;

export type ExportedTodo = Marked<Omit<Todo, 'users' | 'ownerId'> & { users: string[] }>;

export type ExportedMealPlanEntry = Marked<Omit<MealPlanEntry, 'users' | 'ownerId'> & { users: string[] }>;

export type ExportedLabel = Omit<Label, 'ownerId'>;

export interface DataExport {
    meta: { exportedAt: string; schemaVersion: number; username: string; omitted: readonly string[] };
    lists: ExportedList[];
    recipes: ExportedRecipe[];
    mealPlans: ExportedMealPlanEntry[];
    todos: ExportedTodo[];
    labels: ExportedLabel[];
    /** Aisle of every item on the user's lists, keyed by normalised item name. */
    itemCategories: Record<string, ItemCategory>;
    /** Usernames of the user's friends. */
    friends: string[];
}

interface ListSource {
    getListsForUser(userId: string): Promise<
        Array<{
            id: string;
            title: string;
            dateAdded: Date;
            items: Item[];
            users: Array<{ username: string }>;
            listType: string;
            ownerId: string | null;
        }>
    >;
}

interface RecipeSource {
    getRecipesByUserId(userId: string): Promise<Recipe[]>;
}

interface MealPlanSource {
    listAllForUser(userId: string): Promise<MealPlanEntry[]>;
}

interface TodoSource {
    getTodosForUser(userId: string): Promise<Todo[]>;
}

interface LabelSource {
    getLabelsByOwner(ownerId: string): Promise<Label[]>;
}

interface FriendSource {
    listFriends(userId: string): Promise<User[]>;
}

export interface DataExportSources {
    lists: ListSource;
    recipes: RecipeSource;
    mealPlans: MealPlanSource;
    todos: TodoSource;
    labels: LabelSource;
    friends: FriendSource;
}

/** Drops Mongo's `_id` and the other people's ids: the file holds the user's data, not other accounts' internals. */
const withoutInternals = <T extends object>(doc: T): Record<string, unknown> =>
    Object.fromEntries(Object.entries(doc).filter(([key]) => key !== '_id' && key !== 'ownerId' && key !== 'users'));

const usernames = (users?: Array<{ username: string }>): string[] => (users ?? []).map((user) => user.username);

/** Gathers everything a user has in Tandra, owned and shared with them, into one portable document. */
export class DataExportService {
    constructor(
        private readonly sources: DataExportSources,
        private readonly authorization: AuthorizationService
    ) {}

    async exportFor(user: User, now: Date = new Date()): Promise<DataExport> {
        const [lists, recipes, mealPlans, todos, labels, friends] = await Promise.all([
            this.sources.lists.getListsForUser(user.id),
            this.sources.recipes.getRecipesByUserId(user.id),
            this.sources.mealPlans.listAllForUser(user.id),
            this.sources.todos.getTodosForUser(user.id),
            this.sources.labels.getLabelsByOwner(user.id),
            this.sources.friends.listFriends(user.id),
        ]);

        const exportedLists: ExportedList[] = lists.map((list) => ({
            id: list.id,
            title: list.title,
            dateAdded: list.dateAdded,
            listType: list.listType,
            items: list.items,
            users: usernames(list.users),
            ownership: list.ownerId === user.id ? 'owned' : 'shared',
        }));

        return {
            meta: {
                exportedAt: now.toISOString(),
                schemaVersion: EXPORT_SCHEMA_VERSION,
                username: user.username,
                omitted: EXPORT_OMITTED,
            },
            lists: exportedLists,
            recipes: recipes.map(
                (recipe) =>
                    ({
                        ...withoutInternals(recipe),
                        users: usernames(recipe.users),
                        ownership: this.authorization.isOwner(recipe, user.id) ? 'owned' : 'shared',
                    }) as ExportedRecipe
            ),
            mealPlans: mealPlans.map(
                (entry) =>
                    ({
                        ...withoutInternals(entry),
                        users: usernames(entry.users),
                        ownership: entry.ownerId === user.id ? 'owned' : 'shared',
                    }) as ExportedMealPlanEntry
            ),
            todos: todos.map(
                (todo) =>
                    ({
                        ...withoutInternals(todo),
                        users: usernames(todo.users),
                        ownership: todo.ownerId === user.id ? 'owned' : 'shared',
                    }) as ExportedTodo
            ),
            labels: labels.map((label) => ({ id: label.id, name: label.name, color: label.color })),
            itemCategories: itemCategoriesOf(exportedLists),
            friends: friends.map((friend) => friend.username),
        };
    }
}

const itemCategoriesOf = (lists: ExportedList[]): Record<string, ItemCategory> => {
    const categories: Record<string, ItemCategory> = {};

    for (const list of lists) {
        for (const item of list.items) {
            if (item.category) categories[item.name.trim().toLowerCase().replace(/\s+/g, ' ')] = item.category;
        }
    }

    return categories;
};
