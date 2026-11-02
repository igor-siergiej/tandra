import type { User } from '@tandra/types';

import { API_BASE, MOCK_USER, MOCK_USER_2, sessionHeaders } from './auth';

const createListAs = async (
    user: User,
    title: string,
    listType: string,
    selectedFriendIds: Array<string> | undefined
): Promise<{ id: string; title: string }> => {
    const res = await fetch(`${API_BASE}/api/lists`, {
        method: 'PUT',
        headers: await sessionHeaders(user),
        body: JSON.stringify({
            title,
            listType,
            selectedUsers: selectedFriendIds,
            dateAdded: new Date().toISOString(),
        }),
    });

    if (!res.ok) throw new Error(`create list as ${user.username} failed: ${await res.text()}`);

    return res.json() as Promise<{ id: string; title: string }>;
};

const getAsTestUser = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, { headers: await sessionHeaders() });

    if (!res.ok) throw new Error(`GET ${path} failed: ${await res.text()}`);

    return res.json() as Promise<T>;
};

export const apiCreateList = (title: string, listType = 'shopping', selectedFriendIds?: Array<string>) =>
    createListAs(MOCK_USER, title, listType, selectedFriendIds);

export async function apiAddItem(
    listTitle: string,
    itemName: string,
    overrides: { quantity?: number; unit?: string; isSelected?: boolean; dueDate?: string } = {}
) {
    const res = await fetch(`${API_BASE}/api/lists/${encodeURIComponent(listTitle)}/items`, {
        method: 'PUT',
        headers: await sessionHeaders(),
        body: JSON.stringify({ itemName, dateAdded: new Date().toISOString(), ...overrides }),
    });

    if (!res.ok) throw new Error(`apiAddItem failed: ${await res.text()}`);

    return res.json() as Promise<{ id: string; name: string }>;
}

export async function apiDeleteItem(listTitle: string, itemName: string) {
    const itemId = await resolveItemId(listTitle, itemName);

    const res = await fetch(
        `${API_BASE}/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}`,
        { method: 'DELETE', headers: await sessionHeaders() }
    );

    if (!res.ok) throw new Error(`apiDeleteItem failed: ${await res.text()}`);
}

async function resolveItemId(listTitle: string, itemName: string): Promise<string> {
    const res = await fetch(`${API_BASE}/api/lists/title/${encodeURIComponent(listTitle)}`, {
        headers: await sessionHeaders(),
    });

    if (!res.ok) throw new Error(`resolveItemId: get list failed: ${await res.text()}`);
    const list = (await res.json()) as { items: Array<{ id: string; name: string }> };
    const item = list.items.find((i) => i.name === itemName);

    if (!item) throw new Error(`resolveItemId: item '${itemName}' not found in list '${listTitle}'`);

    return item.id;
}

export async function apiUpdateItem(
    listTitle: string,
    itemName: string,
    updates: { isSelected?: boolean; newItemName?: string; quantity?: number; unit?: string }
) {
    const itemId = await resolveItemId(listTitle, itemName);

    const res = await fetch(
        `${API_BASE}/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}`,
        {
            method: 'POST',
            headers: await sessionHeaders(),
            body: JSON.stringify(updates),
        }
    );

    if (!res.ok) throw new Error(`apiUpdateItem failed: ${await res.text()}`);

    return res.json();
}

export async function apiCreateRecipe(
    title: string,
    ingredients: Array<{ name: string; quantity?: number; unit?: string }> = [],
    selectedUsers: Array<string> = [],
    options: {
        servings?: number;
        prepTime?: number;
        cookTime?: number;
        difficulty?: 'easy' | 'medium' | 'hard';
        instructions?: string[];
        tags?: string[];
        link?: string;
    } = {}
) {
    const res = await fetch(`${API_BASE}/api/recipes`, {
        method: 'PUT',
        headers: await sessionHeaders(),
        body: JSON.stringify({
            title,
            dateAdded: new Date().toISOString(),
            user: MOCK_USER,
            selectedUsers,
            ingredients,
            ...options,
        }),
    });

    if (!res.ok) throw new Error(`apiCreateRecipe failed: ${await res.text()}`);

    return res.json() as Promise<{ id: string; title: string; ingredients: Array<{ id: string; name: string }> }>;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: await sessionHeaders(),
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`PUT ${path} failed: ${await res.text()}`);

    return res.json() as Promise<T>;
}

export const apiCreateTodo = (body: {
    title: string;
    dueDate?: string;
    time?: string;
    labelId?: string;
    recurrence?: { freq: string; interval: number; until?: string };
}) => apiPut<{ id: string; title: string }>('/api/todos', body);

export const apiCreateLabel = (body: { name: string; color: string }) =>
    apiPut<{ id: string; name: string; color: string }>('/api/labels', body);

export async function apiGetList(listTitle: string) {
    const res = await fetch(`${API_BASE}/api/lists/title/${encodeURIComponent(listTitle)}`, {
        headers: await sessionHeaders(),
    });

    if (!res.ok) throw new Error(`apiGetList failed: ${await res.text()}`);

    return res.json() as Promise<{
        id: string;
        title: string;
        items: Array<{ id: string; name: string; isSelected: boolean; category?: string; quantity?: number }>;
    }>;
}

export async function apiSetItemCategory(listTitle: string, itemName: string, category: string) {
    const itemId = await resolveItemId(listTitle, itemName);

    const res = await fetch(
        `${API_BASE}/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}/category`,
        { method: 'PUT', headers: await sessionHeaders(), body: JSON.stringify({ category }) }
    );

    if (!res.ok) throw new Error(`apiSetItemCategory failed: ${await res.text()}`);
}

export const apiGetRecipes = () =>
    getAsTestUser<
        Array<{
            id: string;
            title: string;
            link?: string;
            tags?: Array<string>;
            instructions?: Array<string>;
            ingredients: Array<{ id: string; name: string; quantity?: number; unit?: string }>;
            prepTime?: number;
            cookTime?: number;
            servings?: number;
        }>
    >('/api/recipes');

/** Creates a recipe owned by the second mock user, shared with the given user ids (they must be friends). */
export async function apiCreateRecipeAsOtherUser(title: string, sharedWith: Array<string>) {
    const res = await fetch(`${API_BASE}/api/recipes`, {
        method: 'PUT',
        headers: await sessionHeaders(MOCK_USER_2),
        body: JSON.stringify({
            title,
            dateAdded: new Date().toISOString(),
            user: MOCK_USER_2,
            selectedUsers: sharedWith,
            ingredients: [{ name: 'Shared flour' }],
            instructions: ['Shared step'],
        }),
    });

    if (!res.ok) throw new Error(`apiCreateRecipeAsOtherUser failed: ${await res.text()}`);

    return res.json() as Promise<{ id: string; title: string }>;
}

export const apiGetTodos = () =>
    getAsTestUser<
        Array<{
            id: string;
            title: string;
            dueDate?: string;
            time?: string;
            completedAt?: string;
            recurrence?: { freq: string; interval: number; until?: string };
        }>
    >('/api/todos');

/** Todos visible to the second mock user (owned by or shared with them). */
export async function apiGetTodosAsOtherUser() {
    const res = await fetch(`${API_BASE}/api/todos`, { headers: await sessionHeaders(MOCK_USER_2) });

    if (!res.ok) throw new Error(`apiGetTodosAsOtherUser failed: ${await res.text()}`);

    return res.json() as Promise<Array<{ id: string; title: string }>>;
}

/** Creates a todo owned by the second mock user and shared with the given user ids (they must be friends). */
export async function apiCreateTodoAsOtherUser(body: { title: string; dueDate: string }, sharedWith: Array<string>) {
    const res = await fetch(`${API_BASE}/api/todos`, {
        method: 'PUT',
        headers: await sessionHeaders(MOCK_USER_2),
        body: JSON.stringify({ ...body, userIds: sharedWith }),
    });

    if (!res.ok) throw new Error(`apiCreateTodoAsOtherUser failed: ${await res.text()}`);

    return res.json() as Promise<{ id: string; title: string }>;
}

/** Creates a shopping list owned by the second mock user, shared with the given user ids (they must be friends). */
export const apiCreateListAsOtherUser = (title: string, sharedWith: Array<string>) =>
    createListAs(MOCK_USER_2, title, 'shopping', sharedWith);

/** Owner (second mock user) removes a member from their list. */
export async function apiRemoveListMemberAsOtherUser(listTitle: string, memberId: string) {
    const res = await fetch(
        `${API_BASE}/api/lists/${encodeURIComponent(listTitle)}/users/${encodeURIComponent(memberId)}`,
        { method: 'DELETE', headers: await sessionHeaders(MOCK_USER_2) }
    );

    if (!res.ok) throw new Error(`apiRemoveListMemberAsOtherUser failed: ${await res.text()}`);
}
