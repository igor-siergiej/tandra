import type { Context, Next } from 'hono';

import { SlidingWindowLimiter } from '../infrastructure/rateLimit';

const AI_REQUESTS_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

// One budget shared by every fal-backed route, so spreading calls across features doesn't multiply the allowance.
// In memory, so it is per API replica.
const limiter = new SlidingWindowLimiter(AI_REQUESTS_PER_HOUR, HOUR_MS);

setInterval(() => limiter.sweep(), HOUR_MS).unref?.();

type AuthedContext = Context<{ Variables: { user: { id: string; username: string } } }>;

export const aiRateLimit = async (c: AuthedContext, next: Next) => {
    const userId = c.get('user')?.id;
    if (!userId) return next();

    const decision = limiter.check(userId);
    if (!decision.allowed) {
        c.header('Retry-After', String(decision.retryAfterSeconds));
        const minutes = Math.max(1, Math.ceil(decision.retryAfterSeconds / 60));
        return c.json(
            { error: `You've used a lot of AI features in the last hour. Please try again in about ${minutes} min.` },
            429
        );
    }
    return next();
};
