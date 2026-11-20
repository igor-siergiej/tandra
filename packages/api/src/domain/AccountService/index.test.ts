import { describe, expect, it } from 'bun:test';

import type { DiscoveryRecipe, Recipe } from '@tandra/types';

import { AccountService } from './index';

const user = { id: 'u1', username: 'Igor' };

const recipe = (id: string, over: Partial<Recipe> = {}): Recipe =>
    ({ id, title: id, ingredients: [], users: [], ownerId: user.id, dateAdded: new Date(0), ...over }) as Recipe;

interface World {
    ownedRecipes?: Recipe[];
    stored?: string[];
    publications?: Array<{ recipeId: string; libraryId: string; ownerId: string }>;
    libraryCovers?: Record<string, string>;
    failRemovingKeys?: boolean;
}

const setup = (world: World = {}) => {
    const calls: string[] = [];
    const removedKeys: string[] = [];
    const state = { failRemovingKeys: world.failRemovingKeys ?? false };
    const stored = world.stored ?? [];

    const note =
        (name: string) =>
        async (..._args: unknown[]) => {
            calls.push(name);
        };

    const service = new AccountService({
        lists: { deleteOwnedBy: note('lists.deleteOwnedBy'), removeMemberEverywhere: note('lists.removeMember') },
        recipes: {
            findOwnedBy: async () => world.ownedRecipes ?? [],
            deleteOwnedBy: note('recipes.deleteOwnedBy'),
            removeMemberEverywhere: note('recipes.removeMember'),
        },
        todos: { deleteOwnedBy: note('todos.deleteOwnedBy'), removeMemberEverywhere: note('todos.removeMember') },
        mealPlans: {
            deleteOwnedBy: note('mealPlans.deleteOwnedBy'),
            removeMemberEverywhere: note('mealPlans.removeMember'),
        },
        labels: { deleteOwnedBy: note('labels.deleteOwnedBy') },
        pushSubscriptions: { deleteByUserId: note('push.deleteByUserId') },
        friends: { deleteAllForUser: note('friends.deleteAllForUser') },
        invites: { eraseUser: note('invites.eraseUser') },
        publications: {
            listAllByOwner: async () => world.publications ?? [],
            deleteByLibraryId: async (libraryId: string) => {
                calls.push(`publication.delete ${libraryId}`);
            },
        },
        reports: {
            deleteByReporterId: note('reports.deleteByReporterId'),
            deleteByRecipeId: async (libraryId: string) => {
                calls.push(`reports.deleteByRecipeId ${libraryId}`);
            },
        },
        discovery: {
            getRecipes: async (ids: string[]): Promise<DiscoveryRecipe[]> =>
                ids.flatMap((id) =>
                    world.libraryCovers?.[id] ? [{ id, coverImageKey: world.libraryCovers[id] } as DiscoveryRecipe] : []
                ),
            remove: async (libraryId: string) => {
                calls.push(`library.remove ${libraryId}`);
            },
        },
        images: {
            listKeys: async (prefix: string) => stored.filter((key) => key.startsWith(prefix)),
            removeKeys: async (keys: string[]) => {
                if (state.failRemovingKeys) throw new Error('object store down');
                calls.push('images.removeKeys');
                removedKeys.push(...keys);
            },
        },
        credentials: { eraseCredentials: note('credentials.erase') },
        disconnect: (userId: string) => calls.push(`disconnect ${userId}`),
    });

    return { service, calls, removedKeys, state };
};

describe('AccountService.deleteAccount', () => {
    it.each([
        ['another username', 'Somebody'],
        ['the username in other letter case', 'igor'],
        ['an empty string', ''],
        ['the username with a stray space', 'Igor '],
    ])('refuses %s with 403 and touches nothing', async (_label, typed) => {
        const { service, calls } = setup({ ownedRecipes: [recipe('r1')] });

        await expect(service.deleteAccount(user, typed)).rejects.toMatchObject({ status: 403 });
        expect(calls).toEqual([]);
    });

    it('removes the sign-in rows only after everything else, and disconnects live sockets first', async () => {
        const { service, calls } = setup();

        await service.deleteAccount(user, 'Igor');

        expect(calls.at(-1)).toBe('credentials.erase');
        expect(calls.at(-2)).toBe(`disconnect ${user.id}`);
        expect(calls).toEqual(
            expect.arrayContaining([
                'lists.deleteOwnedBy',
                'recipes.deleteOwnedBy',
                'todos.deleteOwnedBy',
                'mealPlans.deleteOwnedBy',
                'labels.deleteOwnedBy',
                'lists.removeMember',
                'recipes.removeMember',
                'todos.removeMember',
                'mealPlans.removeMember',
                'friends.deleteAllForUser',
                'push.deleteByUserId',
                'invites.eraseUser',
                'reports.deleteByReporterId',
            ])
        );
    });

    it('leaves the account signed in when a step fails, so the same request can be repeated', async () => {
        const { service, calls, state } = setup({
            ownedRecipes: [recipe('r1', { aiImageKey: 'recipe-image/r1.webp' })],
        });

        state.failRemovingKeys = true;

        await expect(service.deleteAccount(user, 'Igor')).rejects.toThrow('object store down');
        expect(calls).not.toContain('credentials.erase');
        expect(calls).not.toContain('recipes.deleteOwnedBy');

        state.failRemovingKeys = false;
        await service.deleteAccount(user, 'Igor');

        expect(calls.at(-1)).toBe('credentials.erase');
    });

    it("removes the user's own image files and nobody else's", async () => {
        const { service, removedKeys } = setup({
            ownedRecipes: [
                recipe('r1', {
                    coverImageKey: `recipe-upload/${user.id}/r1/1.webp`,
                    aiImageKey: 'recipe-image/r1.webp',
                }),
                // A cover that is a library image other people still use must stay.
                recipe('r2', { coverImageKey: 'discovery-image/user-9/2.webp' }),
                recipe('r3', { coverImageKey: 'recipe-upload/somebody-else/r3/3.webp' }),
            ],
            stored: [
                `recipe-upload/${user.id}/r1/1.webp`,
                `recipe-upload/${user.id}/old-recipe/0.webp`,
                'recipe-upload/somebody-else/r3/3.webp',
                'recipe-upload/u10/r4/1.webp',
            ],
        });

        await service.deleteAccount(user, 'Igor');

        expect(removedKeys.toSorted()).toEqual(
            [
                `recipe-upload/${user.id}/old-recipe/0.webp`,
                `recipe-upload/${user.id}/r1/1.webp`,
                'recipe-image/r1.webp',
            ].toSorted()
        );
    });

    it('takes published recipes down with their public cover copies, and drops the publication row last', async () => {
        const { service, calls, removedKeys } = setup({
            publications: [{ recipeId: 'r1', libraryId: 'user-1', ownerId: user.id }],
            libraryCovers: { 'user-1': 'discovery-image/user-1/1.webp' },
            stored: ['discovery-image/user-1/1.webp', 'discovery-image/user-1/0.webp', 'discovery-image/user-2/1.webp'],
        });

        await service.deleteAccount(user, 'Igor');

        expect(removedKeys.toSorted()).toEqual(['discovery-image/user-1/0.webp', 'discovery-image/user-1/1.webp']);

        const order = calls.filter((call) => /user-1/.test(call));
        expect(order).toEqual([
            'library.remove user-1',
            'reports.deleteByRecipeId user-1',
            'publication.delete user-1',
        ]);
    });
});
