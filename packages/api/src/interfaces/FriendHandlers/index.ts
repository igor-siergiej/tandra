import { dependencyContainer } from '../../dependencies/container';
import { DependencyToken } from '../../dependencies/types';
import type { FriendService } from '../../domain/FriendService';
import { withAuth } from '../handlerUtils';

const getFriendService = (): FriendService => dependencyContainer.resolve(DependencyToken.FriendService);

export const generateFriendCode = withAuth(async (c, user) => {
    return c.json(await getFriendService().generateCode(user.id, user.username), 201);
});

export const redeemFriendCode = withAuth(async (c, user) => {
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
