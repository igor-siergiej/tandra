import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

export type AuthUser = { id: string; username: string };

/** Values a handler attaches to a log line; nothing structured, so a field can never smuggle an unchecked shape. */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type HonoVars = { Variables: { user: AuthUser } };

const getAuthenticatedUser = (c: Context<HonoVars>): AuthUser | null => {
    const user = c.get('user');

    return user?.id ? user : null;
};

/** Whether a status a thrown error carries is a client/server error status that `c.json` can answer with. */
export const isErrorStatus = (status: number): status is ContentfulStatusCode => status >= 400 && status <= 599;

/** Reads the JSON body and decodes it with `schema`; an unreadable body decodes as `{}`, so the schema should default every field. */
export const readLenientJsonBody = async <S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> =>
    schema.parse(await c.req.json().catch(() => ({})));

export const withAuth =
    (handler: (c: Context<HonoVars>, user: AuthUser) => Promise<Response>) =>
    async (c: Context<HonoVars>): Promise<Response> => {
        const user = getAuthenticatedUser(c);

        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        return handler(c, user);
    };
