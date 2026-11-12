import { beforeEach, describe, expect, it, vi } from 'bun:test';

const mockListService = { getList: vi.fn(), setItemCategory: vi.fn() };
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const mockDependencyContainer = {
    resolve: vi.fn((token: string) => (token === 'ListService' ? mockListService : mockLogger)),
};

vi.mock('../../dependencies', () => ({ dependencyContainer: mockDependencyContainer }));

import { setItemCategory } from './category';

const ctx = (body: unknown, user: { id: string; username: string } | undefined = { id: 'u1', username: 'a' }) =>
    ({
        req: { param: (k: string) => ({ title: 'Groceries', itemId: 'i1' })[k], json: async () => body },
        get: () => user,
        json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
    }) as never;

describe('setItemCategory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListService.getList.mockResolvedValue({ users: [{ id: 'u1' }] });
        mockListService.setItemCategory.mockResolvedValue({ message: 'Category updated successfully' });
    });

    it('sets the category for a list member', async () => {
        const res = await setItemCategory(ctx({ category: 'dairy' }));

        expect(res.status).toBe(200);
        expect(mockListService.setItemCategory).toHaveBeenCalledWith('Groceries', 'i1', 'dairy');
    });

    it('forbids someone who is not on the list', async () => {
        mockListService.getList.mockResolvedValue({ users: [{ id: 'other' }] });

        expect((await setItemCategory(ctx({ category: 'dairy' }))).status).toBe(403);
        expect(mockListService.setItemCategory).not.toHaveBeenCalled();
    });

    it('surfaces service errors with their status', async () => {
        mockListService.setItemCategory.mockRejectedValue(Object.assign(new Error('Item not found'), { status: 404 }));

        await expect(setItemCategory(ctx({ category: 'dairy' }))).rejects.toMatchObject({ status: 404 });
    });
});
