import type {
    DiscoveryPublishRequest,
    DiscoveryRecipe,
    DiscoveryRecipeSummary,
    DiscoverySearchQuery,
    DiscoverySearchResult,
    Item,
    ItemCategory,
    Label,
    ListResponse,
    ListType,
    MealPlanEntry,
    PublishedRecipeRef,
    Recipe,
    RecipeImportResult,
    Todo,
    User,
} from '@tandra/types';

import {
    foldPendingItems,
    foldPendingLabels,
    foldPendingLists,
    foldPendingRecipe,
    foldPendingRecipes,
    foldPendingTodos,
} from '../offline/foldPending';
import { makeRequest } from './makeRequest';
import { MethodType } from './types';

export const getListQuery = (listTitle: string) => ({
    queryKey: [listTitle],
    queryFn: async () => foldPendingItems(listTitle, await getList(listTitle)),
});

const getList = async (
    listTitle: string
): Promise<{
    listType: ListType;
    items: Array<Item>;
    users: Array<{ id: string; username: string }>;
    ownerId?: string;
}> => {
    return await makeRequest({
        pathname: `/api/lists/title/${encodeURIComponent(listTitle)}`,
        method: MethodType.GET,
        operationString: 'get list',
    });
};

export const getListSocketTicket = async (listTitle: string): Promise<string> => {
    const { ticket } = await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/socket-ticket`,
        method: MethodType.POST,
        operationString: 'get list socket ticket',
    });

    return ticket;
};

export const getListsQuery = (userId: string) => ({
    queryKey: ['lists', userId],
    queryFn: async () => foldPendingLists(userId, await getLists(userId)),
});

const getLists = async (userId: string): Promise<Array<ListResponse>> => {
    return await makeRequest({
        pathname: `/api/lists/user/${userId}`,
        method: MethodType.GET,
        operationString: 'get lists',
    });
};

export const addList = async (
    listTitle: string,
    user: User,
    selectedUsers?: Array<string>,
    listType?: ListType,
    id?: string
): Promise<void> => {
    const dateAdded = generateTimestamp(new Date());

    const requestBody = {
        title: listTitle,
        dateAdded,
        user,
        selectedUsers: selectedUsers || [],
        ...(listType !== undefined && { listType }),
        ...(id !== undefined && { id }),
    };

    await makeRequest({
        pathname: '/api/lists',
        method: MethodType.PUT,
        operationString: 'add list',
        body: JSON.stringify(requestBody),
    });
};

export const addItem = async (
    itemName: string,
    listTitle: string,
    quantity?: number,
    unit?: string,
    id?: string
): Promise<void> => {
    const dateAdded = generateTimestamp(new Date());

    await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items`,
        method: MethodType.PUT,
        operationString: 'add item',
        body: JSON.stringify({
            itemName,
            dateAdded,
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
            ...(id !== undefined && { id }),
        }),
    });

    void fetch(`/api/image/${encodeURIComponent(itemName)}`).catch(() => {});
};

export interface SpokenItem {
    name: string;
    quantity?: number;
    unit?: string;
}

export const parseSpokenItems = async (transcript: string): Promise<Array<SpokenItem>> => {
    const result = await makeRequest({
        pathname: '/api/items/parse',
        method: MethodType.POST,
        operationString: 'parse spoken items',
        body: JSON.stringify({ transcript }),
    });

    // SAFETY: POST /api/items/parse answers { items } (see ItemParseHandlers).
    return (result as { items: Array<SpokenItem> }).items;
};

export const addItemsBulk = async (
    listTitle: string,
    items: Array<{ itemName: string; quantity?: number; unit?: string }>
): Promise<{ added: number; skipped: number }> => {
    const dateAdded = generateTimestamp(new Date());

    const result = await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items/bulk`,
        method: MethodType.PUT,
        operationString: 'add items in bulk',
        body: JSON.stringify({
            items: items.map((item) => ({
                itemName: item.itemName,
                dateAdded,
                ...(item.quantity !== undefined && { quantity: item.quantity }),
                ...(item.unit !== undefined && { unit: item.unit }),
            })),
        }),
    });

    return result;
};

export const updateItem = async (itemId: string, isSelected: boolean, listTitle: string) =>
    makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}`,
        method: MethodType.POST,
        operationString: 'update item',
        body: JSON.stringify({ isSelected }),
    });

export const deleteItem = async (itemId: string, listTitle: string) =>
    makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}`,
        method: MethodType.DELETE,
        operationString: 'delete item',
    });

export const deleteList = async (listTitle: string) => {
    return await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}`,
        method: MethodType.DELETE,
        operationString: 'delete list',
    });
};

export const clearList = async (listTitle: string) => {
    return await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/clear`,
        method: MethodType.DELETE,
        operationString: 'clear the list',
    });
};

export const clearSelected = async (listTitle: string) => {
    return await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/clearSelected`,
        method: MethodType.DELETE,
        operationString: 'clear selected items',
    });
};

export const updateListName = async (listTitle: string, newTitle: string) => {
    return await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}`,
        method: MethodType.POST,
        operationString: 'update list name',
        body: JSON.stringify({
            newTitle,
        }),
    });
};

export const updateItemName = async (listTitle: string, itemId: string, newItemName: string) =>
    makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}`,
        method: MethodType.POST,
        operationString: 'update item name',
        body: JSON.stringify({ newItemName }),
    });

export const updateItemQuantity = async (listTitle: string, itemId: string, quantity?: number, unit?: string) =>
    makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}`,
        method: MethodType.POST,
        operationString: 'update item quantity',
        body: JSON.stringify({
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
        }),
    });

export const updateItemCategory = async (listTitle: string, itemId: string, category: ItemCategory) =>
    makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/items/${encodeURIComponent(itemId)}/category`,
        method: MethodType.PUT,
        operationString: 'update item category',
        body: JSON.stringify({ category }),
    });

export const addUserToList = async (listTitle: string, friendId: string): Promise<ListResponse> => {
    return await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/users`,
        method: MethodType.POST,
        operationString: 'add user to list',
        body: JSON.stringify({ friendId }),
    });
};

export const removeUserFromList = async (listTitle: string, userId: string): Promise<ListResponse> => {
    return await makeRequest({
        pathname: `/api/lists/${encodeURIComponent(listTitle)}/users/${encodeURIComponent(userId)}`,
        method: MethodType.DELETE,
        operationString: 'remove user from list',
    });
};

export const getRecipesQuery = (userId: string) => ({
    queryKey: ['recipes', userId],
    queryFn: async () => foldPendingRecipes(userId, await getRecipes(userId)),
});

const getRecipes = async (_userId: string): Promise<Array<Recipe>> => {
    return await makeRequest({
        pathname: '/api/recipes',
        method: MethodType.GET,
        operationString: 'get recipes',
    });
};

export const getRecipeQuery = (recipeId: string) => ({
    queryKey: ['recipe', recipeId],
    queryFn: async () => foldPendingRecipe(recipeId, await getRecipe(recipeId)),
});

const getRecipe = async (recipeId: string): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}`,
        method: MethodType.GET,
        operationString: 'get recipe',
    });
};

// fallow-ignore-next-line complexity
export const addRecipe = async (
    title: string,
    user: User,
    selectedUsers?: Array<string>,
    ingredients?: Array<{ name: string; quantity?: number; unit?: string }>,
    link?: string,
    instructions?: string[],
    id?: string,
    prepTime?: number,
    cookTime?: number,
    servings?: number,
    difficulty?: Recipe['difficulty'],
    tags?: string[]
): Promise<Recipe> => {
    const dateAdded = generateTimestamp(new Date());

    const requestBody = {
        title,
        dateAdded,
        user,
        selectedUsers: selectedUsers || [],
        ...(ingredients !== undefined && { ingredients }),
        ...(link !== undefined && { link }),
        ...(instructions !== undefined && { instructions }),
        ...(id !== undefined && { id }),
        ...(prepTime !== undefined && { prepTime }),
        ...(cookTime !== undefined && { cookTime }),
        ...(servings !== undefined && { servings }),
        ...(difficulty !== undefined && { difficulty }),
        ...(tags !== undefined && { tags }),
    };

    const result = await makeRequest({
        pathname: '/api/recipes',
        method: MethodType.PUT,
        operationString: 'add recipe',
        body: JSON.stringify(requestBody),
    });

    // SAFETY: PUT /api/recipes answers with the created recipe.
    return result as Recipe;
};

export const importRecipe = async (url: string, signal?: AbortSignal): Promise<RecipeImportResult> => {
    return await makeRequest({
        pathname: '/api/recipes/import',
        method: MethodType.POST,
        operationString: 'import recipe from URL',
        body: JSON.stringify({ url }),
        signal,
    });
};

export const suggestIngredientSubstitutes = async (
    ingredientName: string,
    recipeTitle?: string,
    signal?: AbortSignal
): Promise<{ substitutes: string[] }> => {
    return await makeRequest({
        pathname: '/api/recipes/substitutes',
        method: MethodType.POST,
        operationString: 'suggest ingredient substitutes',
        body: JSON.stringify({ ingredientName, recipeTitle }),
        signal,
    });
};

export const importRecipeImage = async (imageUrl: string, signal?: AbortSignal): Promise<File> => {
    const response = await fetch(`/api/recipes/import/image?url=${encodeURIComponent(imageUrl)}`, {
        ...(signal && { signal }),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch recipe cover image: ${response.status}`);
    }

    const blob = await response.blob();
    const extension = blob.type.split('/')[1]?.split('+')[0] || 'jpg';

    return new File([blob], `imported-cover.${extension}`, { type: blob.type });
};

// fallow-ignore-next-line complexity
export const updateRecipe = async (
    recipeId: string,
    title: string,
    ingredients: Array<{ name: string; quantity?: number; unit?: string }>,
    coverImageKey?: string,
    link?: string,
    instructions?: string[],
    prepTime?: number,
    cookTime?: number,
    servings?: number,
    difficulty?: Recipe['difficulty'],
    tags?: string[]
): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}`,
        method: MethodType.PUT,
        operationString: 'update recipe',
        body: JSON.stringify({
            title,
            ingredients,
            ...(coverImageKey !== undefined && { coverImageKey }),
            ...(link !== undefined && { link }),
            ...(instructions !== undefined && { instructions }),
            ...(tags !== undefined && { tags }),
            ...(prepTime !== undefined && { prepTime }),
            ...(cookTime !== undefined && { cookTime }),
            ...(servings !== undefined && { servings }),
            ...(difficulty !== undefined && { difficulty }),
        }),
    });
};

export const deleteRecipe = async (recipeId: string): Promise<void> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}`,
        method: MethodType.DELETE,
        operationString: 'delete recipe',
    });
};

export const addUserToRecipe = async (recipeId: string, friendId: string): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}/users`,
        method: MethodType.POST,
        operationString: 'add user to recipe',
        body: JSON.stringify({ friendId }),
    });
};

export const removeUserFromRecipe = async (recipeId: string, userId: string): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}/users/${encodeURIComponent(userId)}`,
        method: MethodType.DELETE,
        operationString: 'remove user from recipe',
    });
};

export const generateRecipeAiImage = async (recipeId: string): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}/image/generate`,
        method: MethodType.POST,
        operationString: 'generate recipe ai image',
    });
};

export const revertRecipeAiImage = async (recipeId: string): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}/image/revert`,
        method: MethodType.POST,
        operationString: 'revert recipe ai image',
    });
};

export const uploadRecipeImage = async (recipeId: string, file: File): Promise<{ imageKey: string }> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}/image/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to upload image');
    }

    return await response.json();
};

export interface CreateTodoBody {
    title: string;
    /** Timezone-agnostic YYYY-MM-DD day. */
    dueDate?: string;
    time?: string;
    labelId?: string;
    recurrence?: Todo['recurrence'];
    /** Friend user-ids to share this todo with. */
    userIds?: string[];
}

export const getTodosQuery = (userId: string) => ({
    queryKey: ['todos'],
    queryFn: async () => foldPendingTodos(userId, await getTodos()),
});

const getTodos = async (): Promise<Array<Todo>> => {
    return await makeRequest({
        pathname: '/api/todos',
        method: MethodType.GET,
        operationString: 'get todos',
    });
};

export const createTodo = async (body: CreateTodoBody, id?: string): Promise<Todo> => {
    return await makeRequest({
        pathname: '/api/todos',
        method: MethodType.PUT,
        operationString: 'create todo',
        body: JSON.stringify(id !== undefined ? { ...body, id } : body),
    });
};

export type UpdateTodoBody = Partial<Todo> & { clear?: Array<'dueDate' | 'time' | 'labelId' | 'recurrence'> };

export const updateTodo = async (id: string, body: UpdateTodoBody): Promise<Todo> => {
    return await makeRequest({
        pathname: `/api/todos/${encodeURIComponent(id)}`,
        method: MethodType.POST,
        operationString: 'update todo',
        body: JSON.stringify(body),
    });
};

export const deleteTodo = async (id: string): Promise<void> => {
    return await makeRequest({
        pathname: `/api/todos/${encodeURIComponent(id)}`,
        method: MethodType.DELETE,
        operationString: 'delete todo',
    });
};

export const completeTodo = async (id: string, date?: string): Promise<Todo> => {
    return await makeRequest({
        pathname: `/api/todos/${encodeURIComponent(id)}/complete`,
        method: MethodType.POST,
        operationString: 'complete todo',
        body: JSON.stringify(date !== undefined ? { date } : {}),
    });
};

export const getLabelsQuery = (userId: string) => ({
    queryKey: ['labels'],
    queryFn: async () => foldPendingLabels(userId, await getLabels()),
});

const getLabels = async (): Promise<Array<Label>> => {
    return await makeRequest({
        pathname: '/api/labels',
        method: MethodType.GET,
        operationString: 'get labels',
    });
};

export const createLabel = async (body: { name: string; color: string }, id?: string): Promise<Label> => {
    return await makeRequest({
        pathname: '/api/labels',
        method: MethodType.PUT,
        operationString: 'create label',
        body: JSON.stringify(id !== undefined ? { ...body, id } : body),
    });
};

export const updateLabel = async (id: string, body: { name?: string; color?: string }): Promise<Label> => {
    return await makeRequest({
        pathname: `/api/labels/${encodeURIComponent(id)}`,
        method: MethodType.POST,
        operationString: 'update label',
        body: JSON.stringify(body),
    });
};

export const deleteLabel = async (id: string): Promise<void> => {
    return await makeRequest({
        pathname: `/api/labels/${encodeURIComponent(id)}`,
        method: MethodType.DELETE,
        operationString: 'delete label',
    });
};

const generateTimestamp = (now: Date): string => {
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const getVapidPublicKey = async (): Promise<{ publicKey: string | null }> => {
    return await makeRequest({
        pathname: '/api/push/vapid-public-key',
        method: MethodType.GET,
        operationString: 'get vapid public key',
    });
};

export const subscribeToPush = async (subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}): Promise<void> => {
    return await makeRequest({
        pathname: '/api/push/subscribe',
        method: MethodType.POST,
        operationString: 'subscribe to push',
        body: JSON.stringify(subscription),
    });
};

export const unsubscribeFromPush = async (endpoint: string): Promise<void> => {
    return await makeRequest({
        pathname: '/api/push/subscribe',
        method: MethodType.DELETE,
        operationString: 'unsubscribe from push',
        body: JSON.stringify({ endpoint }),
    });
};

export const getFriendsQuery = () => ({
    queryKey: ['friends'],
    queryFn: async () => getFriends(),
});

const getFriends = async (): Promise<Array<User>> => {
    return await makeRequest({
        pathname: '/api/friends',
        method: MethodType.GET,
        operationString: 'get friends',
    });
};

export const generateFriendCode = async (): Promise<{ code: string; expiresAt: string }> => {
    return await makeRequest({
        pathname: '/api/friends/code',
        method: MethodType.POST,
        operationString: 'generate friend code',
    });
};

export const redeemFriendCode = async (code: string): Promise<{ friend: User }> => {
    return await makeRequest({
        pathname: '/api/friends/redeem',
        method: MethodType.POST,
        operationString: 'redeem friend code',
        body: JSON.stringify({ code }),
    });
};

export const unfriend = async (friendId: string): Promise<void> => {
    return await makeRequest({
        pathname: `/api/friends/${encodeURIComponent(friendId)}`,
        method: MethodType.DELETE,
        operationString: 'unfriend',
    });
};

// Repeated parameters (`tags=a&tags=b`), not one comma-joined value: ingredient names contain commas.
// Skips empty values and repeats array values.
// fallow-ignore-next-line complexity
const discoveryQueryString = (query: DiscoverySearchQuery): string => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === '') continue;

        for (const entry of Array.isArray(value) ? value : [value]) params.append(key, String(entry));
    }

    return params.toString();
};

export const searchDiscoveryRecipes = async (query: DiscoverySearchQuery): Promise<DiscoverySearchResult> => {
    const queryString = discoveryQueryString(query);

    return await makeRequest({
        pathname: `/api/discover/recipes${queryString ? `?${queryString}` : ''}`,
        method: MethodType.GET,
        operationString: 'search recipe library',
    });
};

export const getDiscoveryRecipeQuery = (recipeId: string) => ({
    queryKey: ['discover-recipe', recipeId],
    queryFn: async (): Promise<DiscoveryRecipe> =>
        await makeRequest({
            pathname: `/api/discover/recipes/${encodeURIComponent(recipeId)}`,
            method: MethodType.GET,
            operationString: 'get library recipe',
        }),
});

export const getSimilarDiscoveryRecipesQuery = (recipeId: string) => ({
    queryKey: ['discover-similar', recipeId],
    queryFn: async (): Promise<DiscoveryRecipeSummary[]> =>
        await makeRequest({
            pathname: `/api/discover/recipes/${encodeURIComponent(recipeId)}/similar`,
            method: MethodType.GET,
            operationString: 'get similar library recipes',
        }),
});

export const copyDiscoveryRecipe = async (recipeId: string): Promise<Recipe> => {
    return await makeRequest({
        pathname: `/api/discover/recipes/${encodeURIComponent(recipeId)}/copy`,
        method: MethodType.POST,
        operationString: 'add library recipe to my recipes',
    });
};

export const publishRecipe = async (
    recipeId: string,
    request: DiscoveryPublishRequest
): Promise<PublishedRecipeRef> => {
    return await makeRequest({
        pathname: `/api/recipes/${encodeURIComponent(recipeId)}/publish`,
        method: MethodType.POST,
        operationString: 'make recipe public',
        body: JSON.stringify(request),
    });
};

export const getPublishedRecipesQuery = () => ({
    queryKey: ['discover-published'],
    queryFn: async (): Promise<PublishedRecipeRef[]> =>
        await makeRequest({
            pathname: '/api/discover/published',
            method: MethodType.GET,
            operationString: 'get my published recipes',
        }),
});

export const unpublishRecipe = async (libraryId: string): Promise<void> => {
    await makeRequest({
        pathname: `/api/discover/published/${encodeURIComponent(libraryId)}`,
        method: MethodType.DELETE,
        operationString: 'unpublish recipe',
    });
};

export const reportDiscoveryRecipe = async (recipeId: string, reason?: string): Promise<void> => {
    await makeRequest({
        pathname: `/api/discover/recipes/${encodeURIComponent(recipeId)}/report`,
        method: MethodType.POST,
        operationString: 'report library recipe',
        body: JSON.stringify({ reason }),
    });
};

export const getMealPlanQuery = (from: string, to: string) => ({
    queryKey: ['meal-plan', from, to],
    queryFn: async (): Promise<Array<MealPlanEntry>> =>
        makeRequest({
            pathname: `/api/meal-plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            method: MethodType.GET,
            operationString: 'get meal plan',
        }),
});

export const createMealPlanEntry = async (body: {
    date: string;
    recipeId: string;
    servings: number;
}): Promise<MealPlanEntry> =>
    makeRequest({
        pathname: '/api/meal-plan',
        method: MethodType.PUT,
        operationString: 'plan recipe',
        body: JSON.stringify(body),
    });

export const updateMealPlanEntry = async (id: string, body: { date?: string; servings?: number }) =>
    makeRequest({
        pathname: `/api/meal-plan/${encodeURIComponent(id)}`,
        method: MethodType.POST,
        operationString: 'update planned recipe',
        body: JSON.stringify(body),
    });

export const deleteMealPlanEntry = async (id: string): Promise<void> =>
    makeRequest({
        pathname: `/api/meal-plan/${encodeURIComponent(id)}`,
        method: MethodType.DELETE,
        operationString: 'remove planned recipe',
    });
