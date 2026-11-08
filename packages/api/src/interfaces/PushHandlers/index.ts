import { APIError } from '@imapps/api-utils/hono';
import type { PushSubscription } from '@tandra/types';
import type { Context } from 'hono';

import { config } from '../../config';
import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import type { PushSubscriptionRepository } from '../../domain/PushSubscriptionRepository';
import { caughtErrorSchema } from '../../infrastructure/caughtError';
import type { HonoVars } from '../handlerUtils';

const getRepo = (): PushSubscriptionRepository =>
    dependencyContainer.resolve(DependencyToken.PushSubscriptionRepository);

const getLogger = () => dependencyContainer.resolve(DependencyToken.Logger);

const throwApiError = (cause: unknown): never => {
    const err = caughtErrorSchema.parse(cause);
    throw new APIError(err.message ?? 'Internal Server Error', err.status ?? 500);
};

export const getVapidPublicKey = async (c: Context<HonoVars>) => {
    const publicKey = config.get('vapidPublicKey') ?? null;

    return c.json({ publicKey }, 200);
};

export const subscribe = async (c: Context<HonoVars>) => {
    const user = c.get('user');
    const logger = getLogger();
    const body = await c.req.json<{ endpoint?: string; keys?: { p256dh: string; auth: string } }>();

    const sub: PushSubscription = {
        endpoint: body.endpoint,
        userId: user.id,
        keys: body.keys,
        dateAdded: new Date(),
    };

    try {
        await getRepo().upsert(sub);
        logger.info('Push subscription saved', { userId: user.id });

        return c.json({ success: true }, 201);
    } catch (error: unknown) {
        logger.error('Failed to save push subscription', {
            userId: user.id,
            error: caughtErrorSchema.parse(error).message,
        });

        return throwApiError(error);
    }
};

export const unsubscribe = async (c: Context<HonoVars>) => {
    const user = c.get('user');
    const logger = getLogger();
    const body = await c.req.json<{ endpoint?: string }>();

    try {
        await getRepo().deleteByEndpoint(body.endpoint);
        logger.info('Push subscription removed', { userId: user.id });

        return c.json({ success: true }, 200);
    } catch (error: unknown) {
        logger.error('Failed to remove push subscription', {
            userId: user.id,
            error: caughtErrorSchema.parse(error).message,
        });

        return throwApiError(error);
    }
};
