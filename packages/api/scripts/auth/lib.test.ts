import { describe, expect, it } from 'bun:test';

import { memoryAdapter } from 'better-auth/adapters/memory';

import { type Auth, type AuthOptions, createAuth } from '../../src/infrastructure/BetterAuth';
import { resetPassword } from './lib';

const makeAuth = () => {
    const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [], rateLimit: [] };
    const auth = createAuth({
        database: memoryAdapter(db) as unknown as AuthOptions['database'],
        secret: 'test-secret-test-secret-test-secret-123',
        baseURL: 'http://localhost:4000',
        trustedOrigins: ['http://localhost:4000'],
    });
    return { auth, db };
};

const signUpIgor = async (auth: Auth) =>
    (await auth.api.signUpEmail({ body: { email: 'x@y.z', name: 'igor', password: 'old-pass-123', username: 'Igor' } }))
        .user.id;

const signIn = (auth: Auth, username: string, password: string) =>
    auth.api.signInUsername({ body: { username, password } });

describe('resetPassword', () => {
    it('swaps the password and signs the user out everywhere', async () => {
        const { auth, db } = makeAuth();
        const userId = await signUpIgor(auth);
        await signIn(auth, 'igor', 'old-pass-123');
        expect(db.session.length).toBeGreaterThan(0);

        await resetPassword(auth, 'IGOR', 'brand-new-pass');

        expect(db.session).toHaveLength(0);
        await expect(signIn(auth, 'igor', 'old-pass-123')).rejects.toThrow();
        expect((await signIn(auth, 'igor', 'brand-new-pass'))?.user.id).toBe(userId);
    });

    it('refuses unknown usernames and too-short passwords', async () => {
        const { auth } = makeAuth();
        await expect(resetPassword(auth, 'ghost', 'long-enough-pass')).rejects.toThrow('No user with username ghost');
        await signUpIgor(auth);
        await expect(resetPassword(auth, 'igor', 'short')).rejects.toThrow('at least 8');
    });
});
