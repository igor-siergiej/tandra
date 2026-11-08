import { describe, expect, it } from 'bun:test';

import { memoryAdapter } from 'better-auth/adapters/memory';

import { type Auth, type AuthOptions, createAuth } from '../../src/infrastructure/BetterAuth';
import { fake } from '../../src/testing/fake';
import { resetPassword } from './lib';

const makeAuth = () => {
    // The memory adapter's tables; the tests only count rows, so a row is anything with an id.
    const db = {
        user: new Array<{ id: string }>(),
        session: new Array<{ id: string }>(),
        account: new Array<{ id: string }>(),
        verification: new Array<{ id: string }>(),
        rateLimit: new Array<{ id: string }>(),
    };

    const auth = createAuth({
        database: fake<AuthOptions['database']>(memoryAdapter(db)),
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
