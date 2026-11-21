import { describe, expect, it, mock, type Mock } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { List, Recipe, User } from '@tandra/types';
import { ListType } from '@tandra/types';

import { ImageService } from './ImageService';
import { ItemCategoryService } from './ItemCategoryService';
import { ListService } from './ListService';
import { RecipeService } from './RecipeService';

const owner: User = { id: 'user-119', username: 'owner' };

const privateText = [
    'private-list-title',
    'private-item-name',
    'private-recipe-title',
    'private-ingredient',
    'private-instruction',
    'private-transcript',
];

const recipe: Recipe = {
    id: 'recipe-119',
    title: privateText[2],
    ownerId: owner.id,
    users: [owner, { id: 'friend-119', username: 'friend' }],
    ingredients: [{ id: 'ingredient-119', name: privateText[3], quantity: 1, unit: 'kg' }],
    instructions: [privateText[4]],
    dateAdded: new Date(0),
};

const list: List = {
    id: 'list-119',
    title: privateText[0],
    listType: ListType.SHOPPING,
    ownerId: owner.id,
    users: [owner],
    dateAdded: new Date(0),
    items: [{ id: 'item-119', name: privateText[1], isSelected: true, dateAdded: new Date(0) }],
};

interface Fixture {
    error: Error;
    logger: Record<'info' | 'warn' | 'error' | 'debug', Mock<(...args: unknown[]) => void>>;
    recipes: RecipeService;
    lists: ListService;
    fail: () => Promise<never>;
}

const setup = (): Fixture => {
    const error = Object.assign(new Error(privateText.join('; ')), {
        name: 'MongoServerError',
        code: 121,
        document: { recipe, list },
        cause: new Error(privateText.join('; ')),
    });

    const logger = { info: mock(), warn: mock(), error: mock(), debug: mock() };

    const fail = async (): Promise<never> => {
        throw error;
    };

    const recipes = new RecipeService(
        {
            getById: async () => structuredClone(recipe),
            insert: fail,
            update: fail,
            deleteById: fail,
            removeUser: fail,
        } as never,
        { generate: () => 'generated-119' },
        { listKeys: async (): Promise<string[]> => [], removeKeys: async () => {} },
        logger as unknown as Logger,
        undefined,
        undefined,
        undefined,
        { generateTags: fail },
        { generateSubstitutes: fail }
    );

    const lists = new ListService(
        {
            getByRef: async () => structuredClone(list),
            findByUserId: fail,
            insert: fail,
            pushItem: fail,
            replaceIfUnchanged: fail,
            deleteById: fail,
        } as never,
        { generate: () => 'generated-119' },
        logger as unknown as Logger
    );

    return { error, logger, recipes, lists, fail };
};

const cases: Array<[string, (fixture: Fixture) => Promise<unknown>]> = [
    [
        'create recipe',
        ({ recipes }) =>
            recipes.createRecipe(recipe.title, recipe.ingredients, owner.id, owner, undefined, recipe.instructions),
    ],
    ['update recipe', ({ recipes }) => recipes.updateRecipe(recipe.id, recipe.title, recipe.ingredients, owner.id)],
    ['delete recipe', ({ recipes }) => recipes.deleteRecipe(recipe.id, owner.id)],
    ['remove recipe member', ({ recipes }) => recipes.removeUserFromRecipe(recipe.id, 'friend-119', owner.id)],
    ['update recipe cover', ({ recipes }) => recipes.setCoverImageKey(recipe.id, 'recipe-upload/119.webp', owner.id)],
    ['suggest substitutes', ({ recipes }) => recipes.suggestSubstitutes(privateText[3], recipe.title)],
    ['get lists', ({ lists }) => lists.getListsForUser(owner.id)],
    ['create list', ({ lists }) => lists.addList(list.title, new Date(0), owner)],
    ['add item', ({ lists }) => lists.addItem(list.title, `new-${privateText[1]}`, new Date(0))],
    ['rename item', ({ lists }) => lists.updateItemName(list.title, 'item-119', 'replacement')],
    ['select item', ({ lists }) => lists.setItemSelected(list.title, 'item-119', true)],
    ['change quantity', ({ lists }) => lists.updateItemQuantity(list.title, 'item-119', 2)],
    ['clear selected', ({ lists }) => lists.clearSelectedItems(list.title)],
    ['delete item', ({ lists }) => lists.deleteItem(list.title, 'item-119')],
    ['rename list', ({ lists }) => lists.updateListTitle(list.title, 'replacement')],
    ['delete list', ({ lists }) => lists.deleteList(list.title)],
    ['clear list', ({ lists }) => lists.clearList(list.title)],
    [
        'add recipe ingredients',
        ({ lists }) => lists.addItems(list.title, [{ itemName: privateText[3], dateAdded: new Date(0) }], owner.id),
    ],
    [
        'classify item',
        ({ logger, fail }) =>
            new ItemCategoryService({ get: fail } as never, { classify: fail }, logger as unknown as Logger).categorise(
                privateText[1]
            ),
    ],
    [
        'generate item image',
        ({ logger, fail }) =>
            new ImageService(
                {
                    getHeadObject: async () => {
                        throw { code: 'NotFound' };
                    },
                } as never,
                { generateImage: fail },
                logger as unknown as Logger
            ).getImage(privateText[1], owner.id),
    ],
    [
        'store item image',
        ({ logger, fail }) =>
            new ImageService(
                {
                    getHeadObject: async () => {
                        throw { code: 'NotFound' };
                    },
                    putObject: fail,
                } as never,
                { generateImage: async () => ({ buffer: Buffer.from('image'), contentType: 'image/webp' }) },
                logger as unknown as Logger
            ).getImage(privateText[1], owner.id),
    ],
];

describe('dependency errors cannot echo household content into logs', () => {
    it.each(cases)('%s', async (_name, run) => {
        const fixture = setup();
        await run(fixture).catch((): undefined => undefined);
        const errors = [...fixture.logger.error.mock.calls, ...fixture.logger.warn.mock.calls];
        expect(errors.length).toBeGreaterThan(0);

        const logged = JSON.stringify(errors, (_key, value) =>
            value instanceof Error ? { ...value, message: value.message, stack: value.stack } : value
        );

        for (const text of privateText) expect(logged).not.toContain(text);
    });
});
