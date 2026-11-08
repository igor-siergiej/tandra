import { z } from 'zod';

import { ITEM_CATEGORIES } from './index';

// Request-body contracts shared by the API (which enforces them) and the web (which can reuse them to pre-validate).
// They only check shape: handlers keep reading the raw JSON, so valid input behaves exactly as before and unknown
// extra fields are ignored rather than rejected.

const text = z.string().trim().min(1, 'is required and must be a non-empty string');
const id = z.string().min(1);

// dateAdded arrives as an ISO string from JSON.
const dateLike = z.union([z.string(), z.date()]);

// A timezone-agnostic YYYY-MM-DD day; a full ISO instant is tolerated because older clients sent one.
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'must be a YYYY-MM-DD day');

const ingredient = z.object({
    id: z.string().optional(),
    // Not required to be non-blank: a half-filled form row was always accepted and the service tidies it.
    name: z.string(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
});

const difficulty = z.enum(['easy', 'medium', 'hard']);

export const createListBody = z.object({
    title: text,
    dateAdded: dateLike.optional(),
    selectedUsers: z.array(z.string()).optional(),
    listType: z.enum(['shopping']).optional(),
    id: id.optional(),
});

export const updateListBody = z.object({ newTitle: text });

export const addItemBody = z.object({
    itemName: text,
    dateAdded: dateLike.optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    id: id.optional(),
});

export const addItemsBody = z.object({
    items: z
        .array(
            z.object({
                itemName: text,
                quantity: z.number().optional(),
                unit: z.string().optional(),
                dateAdded: dateLike.optional(),
            })
        )
        .min(1, 'must not be empty'),
});

export const updateItemBody = z
    .object({
        isSelected: z.boolean().optional(),
        newItemName: text.optional(),
        quantity: z.number().optional(),
        unit: z.string().optional(),
        category: z.enum(ITEM_CATEGORIES).optional(),
    })
    .refine((body) => Object.values(body).some((value) => value !== undefined), {
        message: 'Either isSelected (boolean), newItemName (string), category, or quantity/unit must be provided',
    });

export const setCategoryBody = z.object({ category: z.enum(ITEM_CATEGORIES) });

export const friendIdBody = z.object({ friendId: text });

export const redeemFriendCodeBody = z.object({ code: text });

export const createRecipeBody = z.object({
    title: text,
    ingredients: z.array(ingredient),
    link: z.string().optional(),
    instructions: z.array(z.string()).optional(),
    selectedUsers: z.array(z.string()).optional(),
    id: id.optional(),
    tags: z.array(z.string()).optional(),
    prepTime: z.number().nonnegative().optional(),
    cookTime: z.number().nonnegative().optional(),
    servings: z.number().positive().optional(),
    difficulty: difficulty.optional(),
});

export const updateRecipeBody = z.object({
    title: text,
    ingredients: z.array(ingredient),
    link: z.string().optional(),
    instructions: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    prepTime: z.number().nonnegative().optional(),
    cookTime: z.number().nonnegative().optional(),
    servings: z.number().positive().optional(),
    difficulty: difficulty.optional(),
});

export const importRecipeBody = z.object({ url: text });

export const substitutesBody = z.object({ ingredientName: text, recipeTitle: z.string().optional() });

export const coverImageBody = z.object({ imageKey: text });

export const parseSpokenItemsBody = z.object({ transcript: text });

const recurrence = z.object({
    freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().positive(),
    until: day.optional(),
});

const member = z.object({ id, username: z.string() });

export const createTodoBody = z.object({
    title: text,
    dueDate: day.optional(),
    time: z.string().optional(),
    labelId: z.string().optional(),
    recurrence: recurrence.optional(),
    id: id.optional(),
    userIds: z.array(z.string()).optional(),
});

export const updateTodoBody = z.object({
    title: text.optional(),
    done: z.boolean().optional(),
    dueDate: day.optional(),
    time: z.string().optional(),
    labelId: z.string().optional(),
    recurrence: recurrence.optional(),
    completedDates: z.array(day).optional(),
    users: z.array(member).optional(),
    /** Optional fields to remove from the todo; a missing field can't be expressed by omitting it. */
    clear: z.array(z.enum(['dueDate', 'time', 'labelId', 'recurrence'])).optional(),
});

export const completeTodoBody = z.object({ date: day.optional() });

export const createLabelBody = z.object({ name: text, color: text, id: id.optional() });

export const updateLabelBody = z.object({ name: text.optional(), color: text.optional() });

export const pushSubscribeBody = z.object({
    endpoint: text,
    keys: z.object({ p256dh: text, auth: text }),
});

export const pushUnsubscribeBody = z.object({ endpoint: text });

export const createMealPlanBody = z.object({
    date: day,
    recipeId: text,
    servings: z.number().positive().max(100),
    id: id.optional(),
    userIds: z.array(z.string()).optional(),
});

export const updateMealPlanBody = z
    .object({ date: day.optional(), servings: z.number().positive().max(100).optional() })
    .refine((body) => body.date !== undefined || body.servings !== undefined, {
        message: 'date or servings must be provided',
    });

export const publishRecipeBody = z.object({ agreeToLicence: z.boolean(), showName: z.boolean().optional() });

export const reportRecipeBody = z.object({ reason: z.string().max(1000).optional() });
