import type { ListResponse, Recipe } from '@tandra/types';
import { z } from 'zod';

import { addItemsBulk, getListsQuery, getRecipesQuery } from '../api';
import { scaleIngredients } from '../utils/convertUnits';

// WebMCP (Chrome origin trial) lets a page hand browser agents, such as Gemini in Chrome, a set of typed tools.
// https://developer.chrome.com/docs/ai/webmcp/imperative-api
interface JsonSchema {
    type: string;
    description?: string;
    minItems?: number;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    required?: string[];
}

const jsonSchema = z.json();
const jsonObjectSchema = z.record(z.string(), jsonSchema).catch({});

type Json = z.infer<typeof jsonSchema>;

interface WebMcpTool {
    name: string;
    description: string;
    inputSchema: JsonSchema;
    annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean };
    // The arguments come from a browser agent, so each tool decodes them before use.
    execute: (args: Json, context: { signal: AbortSignal }) => Promise<string>;
}

interface ModelContext {
    registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
}

declare global {
    // Chrome's WebMCP origin trial adds this to `document`; it is not in lib.dom.
    interface Document {
        modelContext?: ModelContext;
    }
}

// fallow-ignore-next-line unused-export
export const getModelContext = (): ModelContext | null => {
    const context = document.modelContext;

    return context?.registerTool instanceof Function ? context : null;
};

const asText = <T>(value: T): string => JSON.stringify(value);

const findList = (lists: Array<ListResponse>, title: string): ListResponse => {
    const list = lists.find((candidate) => candidate.title.toLowerCase() === title.trim().toLowerCase());

    if (!list) {
        throw new Error(`No list called "${title}". Call getLists to see the available lists.`);
    }

    return list;
};

const findRecipe = (recipes: Array<Recipe>, query: string): Recipe => {
    const needle = query.trim().toLowerCase();
    const recipe = recipes.find((candidate) => candidate.id === query || candidate.title.toLowerCase() === needle);

    if (!recipe) {
        throw new Error(`No recipe matching "${query}" in the user's recipes.`);
    }

    return recipe;
};

const nonEmptyString = z.string().refine((text) => text.trim() !== '');

const asString = (value: Json | undefined, field: string): string => {
    const text = nonEmptyString.safeParse(value);

    if (!text.success) {
        throw new Error(`${field} must be a non-empty string`);
    }

    return text.data;
};

const parseItems = (value: Json | undefined): Array<{ itemName: string; quantity?: number; unit?: string }> => {
    const entries = z.array(jsonSchema).min(1).safeParse(value);

    if (!entries.success) {
        throw new Error('items must be a non-empty array');
    }

    // fallow-ignore-next-line complexity
    return entries.data.map((entry) => {
        const item = jsonObjectSchema.parse(entry);
        const quantity = z.number().safeParse(item.quantity);
        const unit = z.string().min(1).safeParse(item.unit);

        return {
            itemName: asString(item.name, 'item name'),
            ...(quantity.success && { quantity: quantity.data }),
            ...(unit.success && { unit: unit.data }),
        };
    });
};

/**
 * Registers the shopping tools for the signed-in user. Resolves to a cleanup function; a browser without WebMCP
 * gets a no-op, so nothing about the app changes there.
 */
// One registration table for the three tools; splitting it would scatter their shared helpers.
// fallow-ignore-next-line complexity
export const registerWebMcpTools = (userId: string): (() => void) => {
    const context = getModelContext();

    if (!context) return () => {};

    const fetchLists = async (): Promise<Array<ListResponse>> => getListsQuery(userId).queryFn();
    const fetchRecipes = async (): Promise<Array<Recipe>> => getRecipesQuery(userId).queryFn();

    const tools: Array<WebMcpTool> = [
        {
            name: 'getLists',
            description: "List the signed-in user's shopping lists with how many items each holds.",
            inputSchema: { type: 'object', properties: {} },
            annotations: { readOnlyHint: true },
            execute: async () =>
                asText((await fetchLists()).map((list) => ({ title: list.title, itemCount: list.items.length }))),
        },
        {
            name: 'addItemsToList',
            description:
                "Add items to one of the signed-in user's shopping lists. Items already on the list are merged, not duplicated.",
            inputSchema: {
                type: 'object',
                properties: {
                    listTitle: { type: 'string', description: 'Title of an existing list (see getLists).' },
                    items: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                quantity: { type: 'number' },
                                unit: { type: 'string', description: 'e.g. kg, g, l, pack' },
                            },
                            required: ['name'],
                        },
                    },
                },
                required: ['listTitle', 'items'],
            },
            annotations: { consequentialHint: true },
            execute: async (rawArgs) => {
                const args = jsonObjectSchema.parse(rawArgs);
                const list = findList(await fetchLists(), asString(args.listTitle, 'listTitle'));
                const result = await addItemsBulk(list.id, parseItems(args.items));

                return asText({ list: list.title, added: result.added, merged: result.skipped });
            },
        },
        {
            name: 'addRecipeToList',
            description:
                "Add every ingredient of one of the user's recipes to a shopping list, scaled to the requested portions.",
            inputSchema: {
                type: 'object',
                properties: {
                    listTitle: { type: 'string' },
                    recipe: { type: 'string', description: 'Recipe title or id.' },
                    portions: { type: 'number', description: "Defaults to the recipe's own portions." },
                },
                required: ['listTitle', 'recipe'],
            },
            annotations: { consequentialHint: true },
            // fallow-ignore-next-line complexity
            execute: async (rawArgs) => {
                const args = jsonObjectSchema.parse(rawArgs);
                const [lists, recipes] = await Promise.all([fetchLists(), fetchRecipes()]);
                const list = findList(lists, asString(args.listTitle, 'listTitle'));
                const recipe = findRecipe(recipes, asString(args.recipe, 'recipe'));
                const baseline = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
                const requested = z.number().positive().safeParse(args.portions);
                const portions = requested.success ? requested.data : baseline;
                const scaled = scaleIngredients(recipe.ingredients, portions / baseline);

                const result = await addItemsBulk(
                    list.id,
                    scaled.map((ingredient) => ({
                        itemName: ingredient.name,
                        quantity: ingredient.quantity,
                        unit: ingredient.unit,
                    }))
                );

                return asText({ list: list.title, recipe: recipe.title, added: result.added, merged: result.skipped });
            },
        },
    ];

    const controller = new AbortController();

    for (const tool of tools) {
        void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {
            // A tool the browser refuses (e.g. blocked by permissions policy) just isn't offered.
        });
    }

    return () => controller.abort();
};
