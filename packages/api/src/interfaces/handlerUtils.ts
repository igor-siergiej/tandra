import type { Context } from 'hono';

export type AuthUser = { id: string; username: string };

export type HonoVars = { Variables: { user: AuthUser } };

const getAuthenticatedUser = (c: Context<HonoVars>): AuthUser | null => {
    const user = c.get('user');

    return user?.id ? user : null;
};

export const withAuth =
    (handler: (c: Context<HonoVars>, user: AuthUser) => Promise<Response>) =>
    async (c: Context<HonoVars>): Promise<Response> => {
        const user = getAuthenticatedUser(c);

        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        return handler(c, user);
    };
