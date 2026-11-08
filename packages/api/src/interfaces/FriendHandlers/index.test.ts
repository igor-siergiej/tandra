import { beforeEach, describe, expect, it, vi } from 'bun:test';

const mockFriendService = { redeem: vi.fn() };
vi.mock('../../dependencies/container', () => ({
    dependencyContainer: { resolve: vi.fn(() => mockFriendService) },
}));

import { redeemFriendCode } from './index';

const ctx = (userId: string) =>
    ({
        req: { json: async () => ({ code: 'ABCDEF' }) },
        get: () => ({ id: userId, username: userId }),
        header: vi.fn(),
        json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
    }) as never;

describe('redeemFriendCode', () => {
    beforeEach(() => {
        mockFriendService.redeem.mockReset();
        mockFriendService.redeem.mockRejectedValue(Object.assign(new Error('Code not found'), { status: 404 }));
    });

    it('stops a user who keeps guessing codes, without affecting anyone else', async () => {
        for (let i = 0; i < 20; i += 1) {
            await expect(redeemFriendCode(ctx('guesser'))).rejects.toMatchObject({ status: 404 });
        }
        const blocked = await redeemFriendCode(ctx('guesser'));
        expect(blocked.status).toBe(429);
        expect(mockFriendService.redeem).toHaveBeenCalledTimes(20);

        mockFriendService.redeem.mockResolvedValue({ id: 'u1', username: 'alice' });
        const other = await redeemFriendCode(ctx('someone-else'));
        expect(other.status).toBe(200);
    });
});
