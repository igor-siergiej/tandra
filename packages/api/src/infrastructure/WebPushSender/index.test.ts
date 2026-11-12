import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { PushSubscription } from '@tandra/types';

const setVapidDetails = mock(() => {});
const sendNotification = mock(async () => ({ statusCode: 201 }));

mock.module('web-push', () => ({
    default: { setVapidDetails, sendNotification },
    setVapidDetails,
    sendNotification,
}));

const { WebPushSender } = await import('./index');

const sub: PushSubscription = {
    endpoint: 'https://push/e1',
    userId: 'u1',
    keys: { p256dh: 'p', auth: 'a' },
    dateAdded: new Date(),
};

describe('WebPushSender', () => {
    beforeEach(() => {
        setVapidDetails.mockClear();
        sendNotification.mockClear();
    });

    it('is not configured without keys', () => {
        const sender = new WebPushSender(undefined, undefined, undefined);
        expect(sender.isConfigured()).toBe(false);
    });

    it('configures VAPID details when keys present', () => {
        const sender = new WebPushSender('pub', 'priv', 'mailto:a@b.c');
        expect(sender.isConfigured()).toBe(true);
        expect(setVapidDetails).toHaveBeenCalledWith('mailto:a@b.c', 'pub', 'priv');
    });

    it('returns "error" without sending when unconfigured', async () => {
        const sender = new WebPushSender(undefined, undefined, undefined);
        expect(await sender.send(sub, '{}')).toBe('error');
        expect(sendNotification).not.toHaveBeenCalled();
    });

    it('returns "ok" on a successful send', async () => {
        sendNotification.mockResolvedValueOnce({ statusCode: 201 });
        const sender = new WebPushSender('pub', 'priv', 'mailto:a@b.c');
        expect(await sender.send(sub, '{"title":"t"}')).toBe('ok');
        expect(sendNotification).toHaveBeenCalledTimes(1);
    });

    it('returns "gone" when the push service reports 410', async () => {
        sendNotification.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
        const sender = new WebPushSender('pub', 'priv', 'mailto:a@b.c');
        expect(await sender.send(sub, '{}')).toBe('gone');
    });

    it('returns "error" on other failures', async () => {
        sendNotification.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
        const sender = new WebPushSender('pub', 'priv', 'mailto:a@b.c');
        expect(await sender.send(sub, '{}')).toBe('error');
    });
});
