// The last signed-in user, kept so an offline launch still knows who is signed in: the session
// cookie is httpOnly and get-session needs the network. Only `{ id, username }`, never a credential.
const KEY = 'tandra:session-user';

interface CachedSessionUser {
    id: string;
    username: string;
}

export const sessionCache = {
    // Anything other than a well-formed `{ id, username }` (absent, corrupt, old shape) reads as no user.
    // fallow-ignore-next-line complexity
    read(): CachedSessionUser | null {
        try {
            const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CachedSessionUser> | null;

            return parsed && typeof parsed.id === 'string' && typeof parsed.username === 'string'
                ? { id: parsed.id, username: parsed.username }
                : null;
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
