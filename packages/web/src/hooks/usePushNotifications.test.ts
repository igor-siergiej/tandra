import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePushNotifications } from './usePushNotifications';

const subscribeToPush = vi.fn(async () => {});
const unsubscribeFromPush = vi.fn(async () => {});
const getVapidPublicKey = vi.fn(async () => ({ publicKey: 'BIl-key' }));

vi.mock('../api', () => ({
    subscribeToPush: (...args: unknown[]) => subscribeToPush(...args),
    unsubscribeFromPush: (...args: unknown[]) => unsubscribeFromPush(...args),
    getVapidPublicKey: () => getVapidPublicKey(),
}));

vi.mock('../utils/push', () => ({
    urlBase64ToUint8Array: () => new Uint8Array([1, 2, 3]),
}));

const makeSubscription = (endpoint: string) => ({
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
});

const makePushManager = () => ({
    getSubscription: vi.fn(async (): Promise<ReturnType<typeof makeSubscription> | null> => null),
    subscribe: vi.fn(async () => makeSubscription('e-new')),
});

describe('usePushNotifications', () => {
    let pushManager = makePushManager();

    beforeEach(() => {
        subscribeToPush.mockClear();
        unsubscribeFromPush.mockClear();

        pushManager = makePushManager();

        vi.stubGlobal('navigator', {
            serviceWorker: { ready: Promise.resolve({ pushManager }) },
        });
        vi.stubGlobal('Notification', {
            permission: 'default',
            requestPermission: vi.fn(async () => 'granted'),
        });
        vi.stubGlobal('PushManager', () => {});
    });

    it('reports support and an unsubscribed initial state', async () => {
        const { result } = renderHook(() => usePushNotifications());
        expect(result.current.isSupported).toBe(true);
        await waitFor(() => expect(result.current.isSubscribed).toBe(false));
    });

    it('subscribes: requests permission, calls PushManager, posts to the API', async () => {
        const { result } = renderHook(() => usePushNotifications());
        await act(async () => {
            await result.current.subscribe();
        });
        expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
        expect(subscribeToPush).toHaveBeenCalledWith({ endpoint: 'e-new', keys: { p256dh: 'p', auth: 'a' } });
        await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    });

    it('unsubscribes: tears down the PushManager subscription and tells the API', async () => {
        const existing = makeSubscription('e-old');
        pushManager.getSubscription = vi.fn(async () => existing);

        const { result } = renderHook(() => usePushNotifications());
        await waitFor(() => expect(result.current.isSubscribed).toBe(true));

        await act(async () => {
            await result.current.unsubscribe();
        });
        expect(existing.unsubscribe).toHaveBeenCalledTimes(1);
        expect(unsubscribeFromPush).toHaveBeenCalledWith('e-old');
        await waitFor(() => expect(result.current.isSubscribed).toBe(false));
    });
});
