import { dependencyContainer } from '../../dependencies/container';
import { DependencyToken } from '../../dependencies/types';
import type { AccountService } from '../../domain/AccountService';
import { withAuth } from '../handlerUtils';

const getAccountService = (): AccountService => dependencyContainer.resolve(DependencyToken.AccountService);

export const deleteAccount = withAuth(async (c, user) => {
    const { username } = await c.req.json<{ username: string }>();
    await getAccountService().deleteAccount(user, username);

    return new Response(null, { status: 204 });
});
