import type { Logger } from '@imapps/api-utils';
import type { PushSubscription } from '@tandra/types';
import webpush from 'web-push';
import { z } from 'zod';

import { caughtErrorSchema } from '../caughtError';

const pushErrorSchema = z.object({ statusCode: z.number().optional().catch(undefined) }).catch({});

export type SendResult = 'ok' | 'gone' | 'error';

export class WebPushSender {
    private readonly configured: boolean;

    constructor(
        publicKey?: string,
        privateKey?: string,
        subject?: string,
        private readonly logger?: Logger
    ) {
        if (publicKey && privateKey && subject) {
            webpush.setVapidDetails(subject, publicKey, privateKey);
            this.configured = true;
        } else {
            this.configured = false;
            this.logger?.warn('Web push not configured — VAPID keys missing; notifications disabled');
        }
    }

    isConfigured(): boolean {
        return this.configured;
    }

    async send(sub: PushSubscription, payload: string): Promise<SendResult> {
        if (!this.configured) {
            return 'error';
        }

        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);

            return 'ok';
        } catch (error) {
            const { statusCode } = pushErrorSchema.parse(error);

            if (statusCode === 404 || statusCode === 410) {
                return 'gone';
            }

            this.logger?.error('Failed to send web push', {
                endpoint: sub.endpoint,
                statusCode,
                error: caughtErrorSchema.parse(error).message,
            });

            return 'error';
        }
    }
}
