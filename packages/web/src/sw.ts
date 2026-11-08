/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { z } from 'zod';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);

clientsClaim();

// Offline reads depend on this cache (react-query is not persisted). It holds per-user data, so the app deletes
// it on logout (offline/clearUserData.ts); keep the name in sync with API_CACHE_NAME there. Workbox only caches GETs.
// /api/auth is never cached: a stored get-session answer would outlive sign-in and sign-out (the app keeps its
// own offline copy of the signed-in user in auth/sessionCache.ts).
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'),
    new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 2 })
);

registerRoute(({ url }) => url.pathname === '/config.json', new NetworkFirst({ cacheName: 'config-cache' }));

// Preserve the update-prompt flow: the app posts SKIP_WAITING when the user accepts an update.
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting();
    }
});

const pushPayloadSchema = z.object({
    title: z.string().optional().catch(undefined),
    body: z.string().optional().catch(undefined),
    data: z
        .object({ url: z.string().optional().catch(undefined) })
        .optional()
        .catch(undefined),
});

type PushPayload = z.output<typeof pushPayloadSchema>;

const notificationDataSchema = z.object({ url: z.string().optional().catch(undefined) }).catch({});

self.addEventListener('push', (event: PushEvent) => {
    if (!event.data) {
        return;
    }

    let payload: PushPayload;

    try {
        payload = pushPayloadSchema.parse(event.data.json());
    } catch {
        payload = { title: 'Tandra', body: event.data.text() };
    }

    // `renotify`/`vibrate` are valid at runtime but absent from the DOM lib's NotificationOptions.
    const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
        body: payload.body ?? '',
        icon: '/logo-192.png',
        badge: '/badge-96.png',
        data: payload.data ?? {},
        // Per-list tag: repeated updates to the same list replace+re-alert; different lists stack separately.
        tag: payload.data?.url ?? 'tandra',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
    };

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            // Only suppress the OS notification when the user is actively focused on the app.
            // Backgrounded (hidden) or closed windows still get notified.
            // SAFETY: clients.matchAll({ type: 'window' }) only returns WindowClient instances; the DOM typing returns Client.
            const focused = windows.some((client) => (client as WindowClient).focused);

            if (focused) {
                return;
            }

            await self.registration.showNotification(payload.title ?? 'Tandra', options);
        })()
    );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    const targetUrl = notificationDataSchema.parse(event.notification.data).url ?? '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    try {
                        if ('navigate' in client) {
                            // SAFETY: clients.matchAll({ type: 'window' }) only returns WindowClient instances; the DOM typing returns Client.
                            await (client as WindowClient).navigate(targetUrl);
                        }

                        await client.focus();

                        return;
                    } catch {
                        // Focus/navigate failed (e.g. uncontrolled window) — fall through to open a new one.
                        break;
                    }
                }
            }

            await self.clients.openWindow(targetUrl);
        })
    );
});
