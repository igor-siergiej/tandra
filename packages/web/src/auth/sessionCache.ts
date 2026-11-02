import { z } from 'zod';

// The last signed-in user, kept so an offline launch still knows who is signed in: the session
// cookie is httpOnly and get-session needs the network. Only `{ id, username }`, never a credential.
const KEY = 'tandra:session-user';

const cachedUserSchema = z.object({ id: z.string(), username: z.string() });

type CachedSessionUser = z.output<typeof cachedUserSchema>;

export const sessionCache = {
    // Anything other than a well-formed `{ id, username }` (absent, corrupt, old shape) reads as no user.
    // fallow-ignore-next-line complexity
    read(): CachedSessionUser | null {
        try {
            const parsed = cachedUserSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));

            return parsed.success ? { id: parsed.data.id, username: parsed.data.username } : null;
        } catch {
            return null;
        }
    },
    write(user: CachedSessionUser): void {
        localStorage.setItem(KEY, JSON.stringify({ id: user.id, username: user.username }));
    },
    clear(): void {
        localStorage.removeItem(KEY);
    },
};
