import {
    addItemBody,
    addItemsBody,
    completeTodoBody,
    coverImageBody,
    createLabelBody,
    createListBody,
    createMealPlanBody,
    createRecipeBody,
    createTodoBody,
    friendIdBody,
    importRecipeBody,
    parseSpokenItemsBody,
    publishRecipeBody,
    pushSubscribeBody,
    pushUnsubscribeBody,
    redeemFriendCodeBody,
    reportRecipeBody,
    setCategoryBody,
    substitutesBody,
    updateItemBody,
    updateLabelBody,
    updateListBody,
    updateMealPlanBody,
    updateRecipeBody,
    updateTodoBody,
} from '@tandra/types/schemas';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { aiFeaturesFromEnv, authFeaturesFromEnv } from '../config';
import { dependencyContainer } from '../dependencies';
import { DependencyToken } from '../dependencies/types';
import { createDiscoveryHandlers } from '../interfaces/DiscoveryHandlers';
import { generateFriendCode, getFriends, redeemFriendCode, removeFriend } from '../interfaces/FriendHandlers';
import { getImage } from '../interfaces/ImageHandlers';
import { parseSpokenItems } from '../interfaces/ItemParseHandlers';
import { createLabel, deleteLabel, getLabels, updateLabel } from '../interfaces/LabelHandlers';
import {
    addItem,
    addItems,
    addList,
    addUserToList,
    clearList,
    deleteItem,
    deleteList,
    deleteSelected,
    getList,
    getLists,
    removeUserFromList,
    updateItem,
    updateList,
} from '../interfaces/ListHandlers';
import { setItemCategory } from '../interfaces/ListHandlers/category';
import { createListInviteHandlers } from '../interfaces/ListInviteHandlers';
import { receiveLogs } from '../interfaces/LogHandlers';
import {
    createMealPlanEntry,
    deleteMealPlanEntry,
    getMealPlan,
    updateMealPlanEntry,
} from '../interfaces/MealPlanHandlers';
import { createPublicDiscoveryHandlers } from '../interfaces/PublicDiscoveryHandlers';
import { getVapidPublicKey, subscribe, unsubscribe } from '../interfaces/PushHandlers';
import { createRealtimeHandlers } from '../interfaces/RealtimeHandlers';
import {
    addUserToRecipe,
    createRecipe,
    deleteRecipe,
    generateRecipeImage,
    getRecipe,
    getRecipes,
    importRecipe,
    importRecipeImage,
    removeUserFromRecipe,
    revertRecipeImage,
    setCoverImageKey,
    suggestIngredientSubstitutes,
    updateRecipe,
    uploadRecipeImage,
} from '../interfaces/RecipeHandlers';
import { completeTodo, createTodo, deleteTodo, getTodos, updateTodo } from '../interfaces/TodoHandlers';
import { aiRateLimit } from '../middleware/aiRateLimit';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { notifyListChanged } from '../middleware/notifyListChanged';
import { publicDiscoverCors } from '../middleware/publicDiscoverCors';
import { validateJson } from '../middleware/validate';

type Vars = { Variables: { user: { id: string; username: string } } };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const createRoutes = (): Hono<Vars> => {
    const router = new Hono<Vars>();

    router.get('/api/health', (c) =>
        c.json(
            {
                status: 'healthy',
                service: 'tandra-api',
                timestamp: new Date().toISOString(),
            },
            200
        )
    );

    router.get('/api/features', (c) => c.json({ ...aiFeaturesFromEnv(), ...authFeaturesFromEnv() }, 200));

    router.post('/api/logs', receiveLogs);

    router.get('/api/lists/title/:title', authenticate, getList);
    router.get('/api/lists/user/:userId', authenticate, getLists);
    const hub = dependencyContainer.resolve(DependencyToken.ListRealtimeHub);
    const listService = dependencyContainer.resolve(DependencyToken.ListService);

    const { issueListSocketTicket, connectListSocket } = createRealtimeHandlers({
        hub,
        tickets: dependencyContainer.resolve(DependencyToken.WsTicketStore),
        getList: (listTitle) => listService.getList(listTitle),
    });

    const resolveListId = async (listRef: string): Promise<string | undefined> => {
        try {
            return (await dependencyContainer.resolve(DependencyToken.ListService).getList(listRef)).id;
        } catch {
            return undefined;
        }
    };

    const changed = notifyListChanged(hub, resolveListId);

    const removedMember = notifyListChanged(hub, resolveListId, (c, listId) =>
        hub.kick(listId, c.req.param('userId') ?? '')
    );

    router.delete('/api/lists/:title', authenticate, changed, deleteList);
    router.post('/api/lists/:title', authenticate, validateJson(updateListBody), changed, updateList);
    router.put('/api/lists', authenticate, validateJson(createListBody), addList);
    router.put('/api/lists/:title/items/bulk', authenticate, validateJson(addItemsBody), changed, addItems);
    router.put('/api/lists/:title/items', authenticate, validateJson(addItemBody), changed, addItem);
    router.post('/api/lists/:title/items/:itemId', authenticate, validateJson(updateItemBody), changed, updateItem);
    router.put(
        '/api/lists/:title/items/:itemId/category',
        authenticate,
        validateJson(setCategoryBody),
        changed,
        setItemCategory
    );
    router.delete('/api/lists/:title/items/:itemId', authenticate, changed, deleteItem);
    router.delete('/api/lists/:title/clear', authenticate, changed, clearList);
    router.delete('/api/lists/:title/clearSelected', authenticate, changed, deleteSelected);
    router.post('/api/lists/:title/users', authenticate, validateJson(friendIdBody), changed, addUserToList);
    router.delete('/api/lists/:title/users/:userId', authenticate, removedMember, removeUserFromList);

    router.post('/api/lists/:title/socket-ticket', authenticate, issueListSocketTicket);
    router.get('/api/ws/lists/:title', connectListSocket);

    const conditionalImageAuth = async (c: Context<Vars>, next: Next) => {
        const name = c.req.param('name');

        if (name.startsWith('recipe-upload/') || name.startsWith('discovery-image/')) {
            return authenticate(c, next);
        }

        // Cached item images stay public; a session, when present, identifies who is paying for
        // a generation (ImageService refuses to generate without one).
        return optionalAuthenticate(c, next);
    };

    router.get('/api/image/:name', conditionalImageAuth, getImage);

    const uploadBodyLimit = bodyLimit({
        maxSize: MAX_UPLOAD_BYTES,
        onError: (c) => c.json({ error: 'Image exceeds the 10 MB upload limit' }, 413),
    });

    router.post('/api/items/parse', authenticate, validateJson(parseSpokenItemsBody), aiRateLimit, parseSpokenItems);

    router.get('/api/recipes', authenticate, getRecipes);
    router.post('/api/recipes/import', authenticate, validateJson(importRecipeBody), aiRateLimit, importRecipe);
    router.post(
        '/api/recipes/substitutes',
        authenticate,
        validateJson(substitutesBody),
        aiRateLimit,
        suggestIngredientSubstitutes
    );
    router.get('/api/recipes/import/image', authenticate, importRecipeImage);
    router.put('/api/recipes', authenticate, validateJson(createRecipeBody), createRecipe);
    router.get('/api/recipes/:recipeId', authenticate, getRecipe);
    router.put('/api/recipes/:recipeId', authenticate, validateJson(updateRecipeBody), updateRecipe);
    router.delete('/api/recipes/:recipeId', authenticate, deleteRecipe);
    router.post('/api/recipes/:recipeId/users', authenticate, validateJson(friendIdBody), addUserToRecipe);
    router.delete('/api/recipes/:recipeId/users/:targetUserId', authenticate, removeUserFromRecipe);
    router.put('/api/recipes/:recipeId/image', authenticate, validateJson(coverImageBody), setCoverImageKey);
    router.post('/api/recipes/:recipeId/image/upload', authenticate, uploadBodyLimit, uploadRecipeImage);
    router.post('/api/recipes/:recipeId/image/generate', authenticate, aiRateLimit, generateRecipeImage);
    router.post('/api/recipes/:recipeId/image/revert', authenticate, revertRecipeImage);

    const discovery = createDiscoveryHandlers(
        {
            discovery: dependencyContainer.resolve(DependencyToken.DiscoveryService),
            copy: dependencyContainer.resolve(DependencyToken.DiscoveryCopyService),
            publish: dependencyContainer.resolve(DependencyToken.DiscoveryPublishService),
            moderation: dependencyContainer.resolve(DependencyToken.DiscoveryModerationService),
        },
        dependencyContainer.resolve(DependencyToken.Logger)
    );

    router.get('/api/discover/recipes', authenticate, discovery.searchRecipes);
    router.get('/api/discover/recipes/:id/similar', authenticate, discovery.getSimilarRecipes);
    router.get('/api/discover/recipes/:id', authenticate, discovery.getRecipe);
    router.post('/api/discover/recipes/:id/copy', authenticate, discovery.copyRecipe);
    router.post(
        '/api/discover/recipes/:id/report',
        authenticate,
        validateJson(reportRecipeBody, { optional: true }),
        discovery.reportRecipe
    );
    // Admin only (DISCOVERY_ADMIN_USER_IDS): removes a user-published recipe from Mongo and the index.
    router.delete('/api/discover/recipes/:id', authenticate, discovery.delistRecipe);
    router.get('/api/discover/reports', authenticate, discovery.listReports);
    router.get('/api/discover/published', authenticate, discovery.listPublished);
    router.delete('/api/discover/published/:id', authenticate, discovery.unpublishRecipe);
    router.post(
        '/api/recipes/:recipeId/publish',
        authenticate,
        validateJson(publishRecipeBody),
        discovery.publishRecipe
    );

    // Public, unauthenticated, read-only read surface for the marketing site.
    // CORS is open by default (env var opts the operator into an allow-list)
    // and the handlers apply a per-IP rate limit.
    const publicDiscovery = createPublicDiscoveryHandlers(
        { discovery: dependencyContainer.resolve(DependencyToken.DiscoveryService) },
        dependencyContainer.resolve(DependencyToken.Logger)
    );

    router.get('/api/public/discover/recipes', publicDiscoverCors, publicDiscovery.list);
    router.get('/api/public/discover/recipes/:slug', publicDiscoverCors, publicDiscovery.bySlug);

    // List invites: the unauthenticated preview is the only public surface; the rest
    // is owner- or claimer-only.
    const listInvites = createListInviteHandlers(
        dependencyContainer.resolve(DependencyToken.ListInviteService),
        dependencyContainer.resolve(DependencyToken.Logger)
    );

    router.post('/api/lists/:title/invites', authenticate, listInvites.issue);
    router.get('/api/lists/invites', authenticate, listInvites.listMine);
    router.get('/api/lists/invites/:token', listInvites.preview);
    router.post('/api/lists/invites/:token/redeem', authenticate, listInvites.claim);
    router.delete('/api/lists/invites/:token', authenticate, listInvites.revoke);

    router.get('/api/meal-plan', authenticate, getMealPlan);
    router.put('/api/meal-plan', authenticate, validateJson(createMealPlanBody), createMealPlanEntry);
    router.post('/api/meal-plan/:id', authenticate, validateJson(updateMealPlanBody), updateMealPlanEntry);
    router.delete('/api/meal-plan/:id', authenticate, deleteMealPlanEntry);

    router.get('/api/todos', authenticate, getTodos);
    router.put('/api/todos', authenticate, validateJson(createTodoBody), createTodo);
    router.post('/api/todos/:id', authenticate, validateJson(updateTodoBody), updateTodo);
    router.delete('/api/todos/:id', authenticate, deleteTodo);
    router.post(
        '/api/todos/:id/complete',
        authenticate,
        validateJson(completeTodoBody, { optional: true }),
        completeTodo
    );

    router.get('/api/labels', authenticate, getLabels);
    router.put('/api/labels', authenticate, validateJson(createLabelBody), createLabel);
    router.post('/api/labels/:id', authenticate, validateJson(updateLabelBody), updateLabel);
    router.delete('/api/labels/:id', authenticate, deleteLabel);

    router.post('/api/friends/code', authenticate, generateFriendCode);
    router.post('/api/friends/redeem', authenticate, validateJson(redeemFriendCodeBody), redeemFriendCode);
    router.get('/api/friends', authenticate, getFriends);
    router.delete('/api/friends/:friendId', authenticate, removeFriend);

    router.get('/api/push/vapid-public-key', getVapidPublicKey);
    router.post('/api/push/subscribe', authenticate, validateJson(pushSubscribeBody), subscribe);
    router.delete('/api/push/subscribe', authenticate, validateJson(pushUnsubscribeBody), unsubscribe);

    return router;
};
