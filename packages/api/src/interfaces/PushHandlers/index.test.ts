import { beforeEach, describe, expect, it, vi } from 'bun:test';

import * as pushHandlers from './index';

const mockDependencyContainer = {
    resolve: vi.fn(),
};

vi.mock('../../dependencies', () => ({
    dependencyContainer: mockDependencyContainer,
}));

const mockRepo = {
    upsert: vi.fn(),
    deleteByEndpoint: vi.fn(),
};

const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

const mockWebPushSender = {
    isConfigured: vi.fn().mockReturnValue(true),
};

type HonoVars = { Variables: { user: { id: string; username: string } } };

const createMockContext = (overrides: { body?: unknown; user?: { id: string; username: string } } = {}) => {
    const vars: Record<string, unknown> = {
        user: overrides.user ?? { id: 'u1', username: 'owner' },
    };

    return {
        req: {
            json: vi.fn().mockResolvedValue(overrides.body ?? {}),
        },
        json: vi.fn().mockImplementation((payload: unknown, status: number): Response => {
            return new Response(JSON.stringify(payload), {
                status,
                headers: { 'Content-Type': 'application/json' },
            });
        }),
        get: (key: string) => vars[key],
    } as unknown as import('hono').Context<HonoVars>;
};

describe('PushHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDependencyContainer.resolve.mockImplementation((token: string) => {
            if (token === 'PushSubscriptionRepository') return mockRepo;
            if (token === 'Logger') return mockLogger;
            if (token === 'WebPushSender') return mockWebPushSender;
            return null;
        });
    });

    it('returns the configured VAPID public key', async () => {
        const ctx = createMockContext();
        const response = await pushHandlers.getVapidPublicKey(ctx);
        expect(response).toBeDefined();
        expect(ctx.json).toHaveBeenCalled();
    });

    it('upserts a subscription bound to the authenticated user', async () => {
        mockRepo.upsert.mockResolvedValue(undefined);
        const ctx = createMockContext({ body: { endpoint: 'e1', keys: { p256dh: 'p', auth: 'a' } } });
        await pushHandlers.subscribe(ctx);
        expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
        const saved = mockRepo.upsert.mock.calls[0][0];
        expect(saved.endpoint).toBe('e1');
        expect(saved.userId).toBe('u1');
    });

    it('deletes a subscription by endpoint', async () => {
        mockRepo.deleteByEndpoint.mockResolvedValue(undefined);
        const ctx = createMockContext({ body: { endpoint: 'e1' } });
        await pushHandlers.unsubscribe(ctx);
        expect(mockRepo.deleteByEndpoint).toHaveBeenCalledWith('e1');
    });
});
