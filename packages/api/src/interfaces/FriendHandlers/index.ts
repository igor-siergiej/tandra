import { dependencyContainer } from '../../dependencies/container';
import { DependencyToken } from '../../dependencies/types';
import type { FriendService } from '../../domain/FriendService';
import { SlidingWindowLimiter } from '../../infrastructure/rateLimit';
import { withAuth } from '../handlerUtils';

const getFriendService = (): FriendService => dependencyContainer.resolve(DependencyToken.FriendService);

export const generateFriendCode = withAuth(async (c, user) => {
    return c.json(await getFriendService().generateCode(user.id, user.username), 201);
});

// Pairing codes are short, so guessing them must be slow: a person mistypes a few times, a script tries thousands.
const REDEEM_ATTEMPTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
const redeemLimiter = new SlidingWindowLimiter(REDEEM_ATTEMPTS_PER_HOUR, HOUR_MS);
setInterval(() => redeemLimiter.sweep(), HOUR_MS).unref?.();

export const redeemFriendCode = withAuth(async (c, user) => {
    const decision = redeemLimiter.check(user.id);
    if (!decision.allowed) {
        c.header('Retry-After', String(decision.retryAfterSeconds));
        return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
    }
    const { code } = await c.req.json<{ code: string }>();
    const friend = await getFriendService().redeem(code, user.id, user.username);
    return c.json({ friend }, 200);
});

export const getFriends = withAuth(async (c, user) => {
    return c.json(await getFriendService().listFriends(user.id), 200);
});

export const removeFriend = withAuth(async (c, user) => {
    const friendId = c.req.param('friendId');
    await getFriendService().unfriend(user.id, friendId);
    return new Response(null, { status: 204 });
});
