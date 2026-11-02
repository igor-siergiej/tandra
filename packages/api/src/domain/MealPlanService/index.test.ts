import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { MealPlanEntry, Recipe, User } from '@tandra/types';

import { MealPlanService } from './index';

const owner: User = { id: 'u1', username: 'owner' };
const friend: User = { id: 'u2', username: 'friend' };

class MemoryRepo {
    store = new Map<string, MealPlanEntry>();
    async ensureIndexes() {}
    async getById(id: string) {
        return this.store.get(id) ?? null;
    }
    async findForUserBetween(userId: string, from: string, to: string) {
        return [...this.store.values()].filter(
            (e) => e.date >= from && e.date <= to && (e.ownerId === userId || e.users?.some((u) => u.id === userId))
        );
    }
    async insert(entry: MealPlanEntry) {
        this.store.set(entry.id, entry);

        return entry;
    }
    async update(id: string, entry: MealPlanEntry) {
        this.store.set(id, entry);

        return entry;
    }
    async deleteById(id: string) {
        this.store.delete(id);
    }
    async removeMemberFromAll() {}
}

const recipe = (users: User[]): Recipe =>
    ({ id: 'r1', title: 'Pasta', ingredients: [], users, ownerId: 'u1' }) as Recipe;

describe('MealPlanService', () => {
    let repo: MemoryRepo;
    let getRecipe: ReturnType<typeof vi.fn>;
    let friends: { listFriends: ReturnType<typeof vi.fn> };
    let service: MealPlanService;
    let n = 0;

    beforeEach(() => {
        repo = new MemoryRepo();
        getRecipe = vi.fn().mockResolvedValue(recipe([owner]));
        friends = { listFriends: vi.fn().mockResolvedValue([friend]) };
        service = new MealPlanService(
            repo,
            { generate: () => `id-${++n}` },
            { getRecipe },
            undefined,
            friends as never
        );
    });

    const input = { date: '2026-10-12', recipeId: 'r1', servings: 4 };

    it('plans a recipe on a day, sharing with all friends by default', async () => {
        const entry = await service.create('u1', input);

        expect(entry).toMatchObject({
            ownerId: 'u1',
            date: '2026-10-12',
            recipeId: 'r1',
            servings: 4,
            users: [friend],
        });
        expect(repo.store.size).toBe(1);
    });

    it('shares only with the chosen friends and rejects non-friends', async () => {
        expect((await service.create('u1', { ...input, userIds: [] })).users).toBeUndefined();

        await expect(service.create('u1', { ...input, userIds: ['stranger'] })).rejects.toMatchObject({ status: 403 });
    });

    it('replays an existing id without inserting again', async () => {
        const first = await service.create('u1', { ...input, id: 'client-1' });
        const again = await service.create('u1', { ...input, id: 'client-1' });

        expect(again).toBe(first);
        expect(repo.store.size).toBe(1);
    });

    it('refuses a recipe the planner cannot see', async () => {
        getRecipe.mockResolvedValue(recipe([friend]));

        await expect(service.create('u1', input)).rejects.toMatchObject({ status: 403 });
    });

    it.each([
        [{ ...input, date: '12-10-2026' }],
        [{ ...input, date: '2026-13-45' }],
        [{ ...input, servings: 0 }],
        [{ ...input, servings: 1000 }],
        [{ ...input, servings: '4' as never }],
    ])('rejects invalid input %#', async (bad) => {
        await expect(service.create('u1', bad)).rejects.toMatchObject({ status: 400 });
    });

    it('lists the entries a user owns or is shared on, within the range', async () => {
        await service.create('u1', input);
        await service.create('u1', { ...input, date: '2026-11-30' });

        expect(await service.list('u1', '2026-10-12', '2026-10-18')).toHaveLength(1);
        expect(await service.list('u2', '2026-10-12', '2026-10-18')).toHaveLength(1);
        expect(await service.list('u3', '2026-10-12', '2026-10-18')).toHaveLength(0);
    });

    it('rejects reversed or oversized ranges', async () => {
        await expect(service.list('u1', '2026-10-18', '2026-10-12')).rejects.toMatchObject({ status: 400 });
        await expect(service.list('u1', '2026-01-01', '2026-12-31')).rejects.toMatchObject({ status: 400 });
    });

    it('lets a shared member change servings but not a stranger', async () => {
        const { id } = await service.create('u1', input);

        expect((await service.update(id, 'u2', { servings: 2 })).servings).toBe(2);
        await expect(service.update(id, 'u3', { servings: 2 })).rejects.toMatchObject({ status: 403 });
    });

    it('moves an entry to another day', async () => {
        const { id } = await service.create('u1', input);

        expect((await service.update(id, 'u1', { date: '2026-10-14' })).date).toBe('2026-10-14');
    });

    it('lets only the owner delete', async () => {
        const { id } = await service.create('u1', input);

        await expect(service.remove(id, 'u2')).rejects.toMatchObject({ status: 403 });
        await service.remove(id, 'u1');
        expect(repo.store.size).toBe(0);
        await expect(service.remove(id, 'u1')).rejects.toMatchObject({ status: 404 });
    });
});
