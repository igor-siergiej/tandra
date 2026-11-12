import { describe, expect, it, mock } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { type AuthOptions, createAuth } from './index';

type AuthDatabase = AuthOptions['database'];

const makeAuth = (google?: { clientId: string; clientSecret: string }, logger?: Logger) => {
    const db = {
        user: [],
        session: [],
        account: [],
        verification: [],
        rateLimit: [],
    } as Record<string, unknown[]>;

    const memoryAuthDb = memoryAdapter(db) as unknown as AuthDatabase;

    const auth = createAuth({
        database: memoryAuthDb,
        secret: 'test-secret-test-secret-test-secret-123',
        baseURL: 'http://localhost:4000',
        trustedOrigins: ['http://localhost:4000'],
        google,
        logger,
    });

    return { auth, db };
};

interface StoredUser {
    id: string;
    email: string;
    name: string;
    username?: string;
    displayUsername?: string;
}

interface StoredAccount {
    userId: string;
    providerId: string;
    accountId: string;
    password: string;
}

describe('createAuth', () => {
    it('stores a placeholder email on password sign-up, ignoring the submitted one', async () => {
        const { auth, db } = makeAuth();

        const result = await auth.api.signUpEmail({
            body: {
                email: 'victim@gmail.com',
                name: 'x',
                password: 'password123',
                username: 'Alice',
            },
        });

        expect(result.user.id).toBeString();
        const [user] = db.user as Array<StoredUser>;
        expect(user.email).toMatch(/^[0-9a-f-]{36}@users\.invalid$/);
        expect(user.username).toBe('alice');
        expect(user.displayUsername).toBe('Alice');
    });

    it('rejects password sign-up without a username', async () => {
        const { auth } = makeAuth();
        await expect(
            auth.api.signUpEmail({ body: { email: 'a@b.c', name: 'x', password: 'password123' } })
        ).rejects.toThrow();
    });

    it('logs a registration once, not on later sign-ins', async () => {
        const info = mock();
        const { auth } = makeAuth(undefined, { info } as unknown as Logger);

        const { user } = await auth.api.signUpEmail({
            body: { email: 'x@y.z', name: 'x', password: 'password123', username: 'Carol' },
        });

        await auth.api.signInUsername({ body: { username: 'carol', password: 'password123' } });
        expect(info).toHaveBeenCalledTimes(1);
        expect(info).toHaveBeenCalledWith('User registered', {
            userId: user.id,
            username: 'carol',
            method: 'password',
        });
    });

    it('signs in by username with an argon2id hash and refuses /sign-in/email', async () => {
        const { auth, db } = makeAuth();
        await auth.api.signUpEmail({
            body: { email: 'x@y.z', name: 'x', password: 'password123', username: 'bob' },
        });
        const account = (db.account as Array<StoredAccount>)[0];
        expect(account.password.startsWith('$argon2id$')).toBe(true);

        const ok = await auth.api.signInUsername({ body: { username: 'BOB', password: 'password123' } });
        expect(ok?.user.id).toBeString();

        const email = (db.user as Array<StoredUser>)[0].email;
        await expect(auth.api.signInEmail({ body: { email, password: 'password123' } })).rejects.toThrow();
    });

    it('verifies a legacy bcrypt hash', async () => {
        const { auth } = makeAuth();
        const ctx = await auth.$context;
        expect(
            await ctx.password.verify({
                hash: await Bun.password.hash('pw12345678', 'bcrypt'),
                password: 'pw12345678',
            })
        ).toBe(true);
    });

    it('offers Google only when configured', async () => {
        expect((await makeAuth().auth.$context).socialProviders.map((p) => p.id)).toEqual([]);
        const withGoogle = makeAuth({ clientId: 'id', clientSecret: 'secret' });
        expect((await withGoogle.auth.$context).socialProviders.map((p) => p.id)).toEqual(['google']);
    });

    it('rate-limits sign-in per Cloudflare client IP, not per tunnel address', async () => {
        const { auth } = makeAuth();

        // In prod X-Forwarded-For is always the tunnel's address; only CF-Connecting-IP tells clients apart.
        const attempt = (clientIp: string) =>
            auth.handler(
                new Request('http://localhost:4000/api/auth/sign-in/username', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        origin: 'http://localhost:4000',
                        'x-forwarded-for': '172.18.0.5',
                        'cf-connecting-ip': clientIp,
                    },
                    body: JSON.stringify({ username: 'nobody', password: 'wrong-password' }),
                })
            );

        const attacker = [];

        for (let i = 0; i < 11; i++) attacker.push((await attempt('203.0.113.7')).status);
        expect(attacker.at(-1)).toBe(429);

        expect((await attempt('198.51.100.20')).status).toBe(401);
    });
});
