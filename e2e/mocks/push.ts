import type { Page } from '@playwright/test';

export interface FakePushOptions {
    permission: NotificationPermission;
    /** What Notification.requestPermission() resolves to; defaults to `permission`. */
    requestResult?: NotificationPermission;
    subscribed?: boolean;
    vapidPublicKey?: string | null;
}

// Playwright blocks service workers, so navigator.serviceWorker.ready never settles and PushManager is
// absent in some builds; this fakes both plus the API endpoints so the toggle can be driven end to end.
export const installFakePush = async (page: Page, opts: FakePushOptions) => {
    const vapid =
        opts.vapidPublicKey === undefined
            ? 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBxXhU_E'
            : opts.vapidPublicKey;

    await page.route('**/api/push/vapid-public-key', (route) => route.fulfill({ json: { publicKey: vapid } }));
    await page.route('**/api/push/subscribe', (route) => route.fulfill({ json: { ok: true } }));

    await page.addInitScript((o: FakePushOptions) => {
        let subscription: object | null = o.subscribed
            ? { endpoint: 'https://push.example/fake', unsubscribe: async () => true, toJSON: () => ({}) }
            : null;

        const pushManager = {
            getSubscription: async () => subscription,
            subscribe: async () => {
                subscription = {
                    endpoint: 'https://push.example/fake',
                    unsubscribe: async () => {
                        subscription = null;

                        return true;
                    },
                    toJSON: () => ({ endpoint: 'https://push.example/fake', keys: { p256dh: 'p', auth: 'a' } }),
                };

                return subscription;
            },
        };

        Object.defineProperty(navigator.serviceWorker, 'ready', {
            configurable: true,
            get: () => Promise.resolve({ pushManager }),
        });
        Object.defineProperty(window, 'PushManager', {
            configurable: true,
            writable: true,
            value: function PushManager() {},
        });

        let permission = o.permission;

        const FakeNotification = Object.assign(function Notification() {}, {
            requestPermission: async () => {
                permission = o.requestResult ?? o.permission;

                return permission;
            },
        });

        Object.defineProperty(FakeNotification, 'permission', { get: () => permission });
        Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification });
    }, opts);
};
