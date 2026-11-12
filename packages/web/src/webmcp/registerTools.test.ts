import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const api = vi.hoisted(() => ({
    addItemsBulk: vi.fn(),
    getListsQuery: vi.fn(),
    getRecipesQuery: vi.fn(),
}));

vi.mock('../api', () => api);

import { getModelContext, registerWebMcpTools } from './registerTools';

type Tool = {
    name: string;
    annotations?: Record<string, boolean>;
    inputSchema: { required?: string[] };
    execute: (args: Record<string, unknown>, ctx: { signal: AbortSignal }) => Promise<string>;
};

const setContext = (value: unknown) => {
    (document as unknown as { modelContext?: unknown }).modelContext = value;
};

const lists = [
    { id: 'l1', title: 'Groceries', items: [{}, {}] },
    { id: 'l2', title: 'Party', items: [] },
];

const recipes = [
    {
        id: 'r1',
        title: 'Pasta',
        servings: 2,
        ingredients: [
            { id: 'a', name: 'spaghetti', quantity: 200, unit: 'g' },
            { id: 'b', name: 'garlic' },
        ],
    },
];

describe('registerWebMcpTools', () => {
    let registered: Tool[];
    let signals: AbortSignal[];
    const ctx = { signal: new AbortController().signal };
    const tool = (name: string) => registered.find((t) => t.name === name) as Tool;

    beforeEach(() => {
        registered = [];
        signals = [];
        setContext({
            registerTool: vi.fn(async (t: Tool, options?: { signal?: AbortSignal }) => {
                registered.push(t);

                if (options?.signal) signals.push(options.signal);
            }),
        });
        api.getListsQuery.mockReturnValue({ queryFn: async () => lists });
        api.getRecipesQuery.mockReturnValue({ queryFn: async () => recipes });
        api.addItemsBulk.mockResolvedValue({ added: 2, skipped: 0 });
    });

    afterEach(() => {
        setContext(undefined);
        vi.clearAllMocks();
    });

    it('does nothing in a browser without WebMCP', () => {
        setContext(undefined);

        expect(getModelContext()).toBeNull();
        expect(() => registerWebMcpTools('u1')()).not.toThrow();
    });

    it('registers getLists, addItemsToList and addRecipeToList', () => {
        registerWebMcpTools('u1');

        expect(registered.map((t) => t.name).sort()).toEqual(['addItemsToList', 'addRecipeToList', 'getLists']);
        expect(tool('getLists').annotations).toEqual({ readOnlyHint: true });
        expect(tool('addItemsToList').annotations).toEqual({ consequentialHint: true });
        expect(tool('addItemsToList').inputSchema.required).toEqual(['listTitle', 'items']);
    });

    it('withdraws the tools when cleaned up', () => {
        const cleanup = registerWebMcpTools('u1');
        cleanup();

        expect(signals.every((signal) => signal.aborted)).toBe(true);
    });

    it('getLists reports titles and sizes', async () => {
        registerWebMcpTools('u1');

        expect(JSON.parse(await tool('getLists').execute({}, ctx))).toEqual([
            { title: 'Groceries', itemCount: 2 },
            { title: 'Party', itemCount: 0 },
        ]);
    });

    it('addItemsToList adds to the named list, matching the title case-insensitively', async () => {
        registerWebMcpTools('u1');

        const result = await tool('addItemsToList').execute(
            { listTitle: 'groceries', items: [{ name: 'milk', quantity: 2, unit: 'l' }, { name: 'bread' }] },
            ctx
        );

        expect(api.addItemsBulk).toHaveBeenCalledWith('l1', [
            { itemName: 'milk', quantity: 2, unit: 'l' },
            { itemName: 'bread' },
        ]);
        expect(JSON.parse(result)).toEqual({ list: 'Groceries', added: 2, merged: 0 });
    });

    it.each([
        [{ listTitle: 'Nope', items: [{ name: 'milk' }] }, /No list called/],
        [{ listTitle: 'Groceries', items: [] }, /non-empty array/],
        [{ listTitle: 'Groceries', items: [{ quantity: 1 }] }, /item name/],
        [{ items: [{ name: 'milk' }] }, /listTitle/],
    ])('addItemsToList rejects bad input %#', async (args, message) => {
        registerWebMcpTools('u1');

        await expect(tool('addItemsToList').execute(args, ctx)).rejects.toThrow(message);
        expect(api.addItemsBulk).not.toHaveBeenCalled();
    });

    it('addRecipeToList scales the recipe to the requested portions', async () => {
        registerWebMcpTools('u1');

        await tool('addRecipeToList').execute({ listTitle: 'Party', recipe: 'pasta', portions: 6 }, ctx);

        expect(api.addItemsBulk).toHaveBeenCalledWith('l2', [
            { itemName: 'spaghetti', quantity: 600, unit: 'g' },
            { itemName: 'garlic', quantity: undefined, unit: undefined },
        ]);
    });

    it('addRecipeToList uses the recipe portions by default and also accepts an id', async () => {
        registerWebMcpTools('u1');

        await tool('addRecipeToList').execute({ listTitle: 'Party', recipe: 'r1' }, ctx);

        expect(api.addItemsBulk.mock.calls[0][1][0]).toMatchObject({ quantity: 200 });
    });

    it('addRecipeToList rejects an unknown recipe', async () => {
        registerWebMcpTools('u1');

        await expect(tool('addRecipeToList').execute({ listTitle: 'Party', recipe: 'soup' }, ctx)).rejects.toThrow(
            /No recipe matching/
        );
    });
});
