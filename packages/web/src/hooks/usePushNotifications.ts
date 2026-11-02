import { useCallback, useEffect, useState } from 'react';

import { getVapidPublicKey, subscribeToPush, unsubscribeFromPush } from '../api';
import { logger } from '../utils/logger';
import { urlBase64ToUint8Array } from '../utils/push';

const isPushSupported = (): boolean =>
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window;

export const usePushNotifications = () => {
    const [isSupported] = useState(isPushSupported);
    const [permission, setPermission] = useState<NotificationPermission>(
        isPushSupported() ? Notification.permission : 'denied'
    );
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isBusy, setIsBusy] = useState(false);

    useEffect(() => {
        if (!isSupported) return;
        void navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => setIsSubscribed(Boolean(sub)))
            .catch(() => setIsSubscribed(false));
    }, [isSupported]);

    const subscribe = useCallback(async () => {
        if (!isSupported || isBusy) return;
        setIsBusy(true);
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result !== 'granted') return;

            const { publicKey } = await getVapidPublicKey();
            if (!publicKey) {
                logger.warn('Push not configured on the server (no VAPID key)');
                return;
            }

            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            await subscribeToPush({ endpoint: json.endpoint, keys: json.keys });
            setIsSubscribed(true);
        } catch (error) {
            logger.error('Failed to subscribe to push', { error: (error as Error).message });
        } finally {
            setIsBusy(false);
        }
    }, [isSupported, isBusy]);

    const unsubscribe = useCallback(async () => {
        if (!isSupported || isBusy) return;
        setIsBusy(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                const { endpoint } = sub;
                await sub.unsubscribe();
                await unsubscribeFromPush(endpoint);
            }
            setIsSubscribed(false);
        } catch (error) {
            logger.error('Failed to unsubscribe from push', { error: (error as Error).message });
        } finally {
            setIsBusy(false);
        }
    }, [isSupported, isBusy]);

    return { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe };
};
