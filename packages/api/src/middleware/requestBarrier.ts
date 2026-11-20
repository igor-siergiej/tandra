import type { MiddlewareHandler } from 'hono';

import type { MongoRequestBarrier } from '../infrastructure/MongoRequestBarrier';

export const requestBarrier =
    (barrier: MongoRequestBarrier): MiddlewareHandler =>
    async (c, next) => {
        // These endpoints neither read nor write personal data and remain usable during a deletion/recovery.
        if (['/api/health', '/api/features', '/api/metrics'].includes(c.req.path)) return next();

        // All DELETEs discard ownership references. Serializing them also protects legacy images referenced by
        // multiple recipes: two deletions must not both retain a shared key and then discard its last references.
        const release = await barrier.acquire(c.req.method === 'DELETE');

        try {
            await next();
        } finally {
            await release();
        }
    };
