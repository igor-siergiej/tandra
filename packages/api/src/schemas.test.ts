import { describe, expect, it } from 'bun:test';

import * as schemas from '@tandra/types/schemas';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
    expect(schema.safeParse(value).success).toBe(true);
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
    expect(schema.safeParse(value).success).toBe(false);

describe('request schemas', () => {
    it('createListBody needs a non-blank title and knows the list types', () => {
        ok(schemas.createListBody, { title: 'Groceries', dateAdded: '2026-10-10T00:00:00Z', listType: 'shopping' });
        bad(schemas.createListBody, { title: '   ' });
        bad(schemas.createListBody, {});
        bad(schemas.createListBody, { title: 'x', listType: 'wishlist' });
        bad(schemas.createListBody, { title: 'x', selectedUsers: 'u1' });
    });

    it('addItemBody and addItemsBody need names, and bulk needs at least one item', () => {
        ok(schemas.addItemBody, { itemName: 'milk', quantity: 2, unit: 'l' });
        bad(schemas.addItemBody, { itemName: '' });
        bad(schemas.addItemBody, { itemName: 'milk', quantity: '2' });
        ok(schemas.addItemsBody, { items: [{ itemName: 'milk' }] });
        bad(schemas.addItemsBody, { items: [] });
        bad(schemas.addItemsBody, { items: [{ quantity: 1 }] });
    });

    it('updateItemBody needs at least one real change and a valid category', () => {
        ok(schemas.updateItemBody, { isSelected: true });
        ok(schemas.updateItemBody, { category: 'dairy' });
        bad(schemas.updateItemBody, {});
        bad(schemas.updateItemBody, { newItemName: '  ' });
        bad(schemas.updateItemBody, { category: 'snacks' });
        bad(schemas.setCategoryBody, {});
    });

    it('recipe bodies need a title, an ingredient array and a known difficulty', () => {
        ok(schemas.createRecipeBody, {
            title: 'Pasta',
            ingredients: [{ name: 'spaghetti', quantity: 200 }],
            servings: 2,
        });
        ok(schemas.createRecipeBody, { title: 'Pasta', ingredients: [], difficulty: 'easy' });
        bad(schemas.createRecipeBody, { title: '', ingredients: [] });
        bad(schemas.createRecipeBody, { title: 'Pasta' });
        bad(schemas.createRecipeBody, { title: 'Pasta', ingredients: [], difficulty: 'impossible' });
        bad(schemas.createRecipeBody, { title: 'Pasta', ingredients: [{ quantity: 2 }] });
        bad(schemas.updateRecipeBody, { title: 'Pasta', ingredients: 'none' });
    });

    it('simple string bodies reject blanks', () => {
        for (const [schema, value] of [
            [schemas.updateListBody, { newTitle: ' ' }],
            [schemas.friendIdBody, { friendId: '' }],
            [schemas.redeemFriendCodeBody, { code: '' }],
            [schemas.importRecipeBody, { url: '' }],
            [schemas.substitutesBody, { ingredientName: ' ' }],
            [schemas.coverImageBody, { imageKey: '' }],
            [schemas.parseSpokenItemsBody, { transcript: 42 }],
            [schemas.pushUnsubscribeBody, {}],
        ] as const) {
            bad(schema, value);
        }
    });

    it('pushSubscribeBody needs the endpoint and both keys', () => {
        ok(schemas.pushSubscribeBody, { endpoint: 'https://push', keys: { p256dh: 'a', auth: 'b' } });
        bad(schemas.pushSubscribeBody, { endpoint: 'https://push', keys: { p256dh: 'a' } });
        bad(schemas.pushSubscribeBody, { keys: { p256dh: 'a', auth: 'b' } });
    });

    it('todo bodies take day strings and recurrences', () => {
        ok(schemas.createTodoBody, {
            title: 'Bins',
            dueDate: '2026-10-12',
            recurrence: { freq: 'weekly', interval: 1 },
        });
        bad(schemas.createTodoBody, { title: 'Bins', dueDate: 'tomorrow' });
        bad(schemas.createTodoBody, { title: 'Bins', recurrence: { freq: 'hourly', interval: 1 } });
        ok(schemas.updateTodoBody, { done: true, users: [{ id: 'u1', username: 'a' }] });
        bad(schemas.updateTodoBody, { done: 'yes' });
        ok(schemas.completeTodoBody, {});
        bad(schemas.completeTodoBody, { date: 'later' });
    });

    it('label bodies', () => {
        ok(schemas.createLabelBody, { name: 'Work', color: '#fff' });
        bad(schemas.createLabelBody, { name: 'Work' });
        ok(schemas.updateLabelBody, { color: '#000' });
    });

    it('meal plan bodies', () => {
        ok(schemas.createMealPlanBody, { date: '2026-10-12', recipeId: 'r1', servings: 4 });
        bad(schemas.createMealPlanBody, { date: '2026-10-12', recipeId: 'r1', servings: 0 });
        bad(schemas.createMealPlanBody, { date: '2026-10-12', recipeId: 'r1', servings: 1000 });
        bad(schemas.createMealPlanBody, { date: '12/10', recipeId: 'r1', servings: 2 });
        ok(schemas.updateMealPlanBody, { servings: 3 });
        bad(schemas.updateMealPlanBody, {});
    });

    it('publish and report bodies', () => {
        ok(schemas.publishRecipeBody, { agreeToLicence: true, showName: false });
        bad(schemas.publishRecipeBody, {});
        ok(schemas.reportRecipeBody, {});
        ok(schemas.reportRecipeBody, { reason: 'spam' });
        bad(schemas.reportRecipeBody, { reason: 'x'.repeat(2000) });
    });
});
