import type { Logger } from '@imapps/api-utils';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { username } from 'better-auth/plugins';
import { z } from 'zod';

// Reserved TLD that never routes (RFC 2606). Password users get `<uuid>@<this>` so Better
// Auth's `user.email` constraint is satisfied without ever accepting a real address:
// keeping any real email out of the row is what stops an unverified password sign-up from
// later locking a Google user out via `account_not_linked`.
const PLACEHOLDER_EMAIL_DOMAIN = 'users.invalid';

// Matches the register form's `usernameField` (packages/web/src/hooks/authSchemas.ts).
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;

const rejectEmailSignIn = (path: string) => {
    // Placeholder emails are not credentials; passwords sign in by username only.
    if (path === '/sign-in/email') throw new APIError('NOT_FOUND');
};

const signUpBodySchema = z.looseObject({ username: z.string().catch('') }).catch({ username: '' });

export interface AuthOptions {
    database: BetterAuthOptions['database'];
    secret: string;
    baseURL: string;
    trustedOrigins: Array<string>;
    google?: { clientId: string; clientSecret: string };
    logger?: Logger;
}

export const createAuth = ({ database, secret, baseURL, trustedOrigins, google, logger }: AuthOptions) =>
    betterAuth({
        database,
        secret,
        baseURL,
        trustedOrigins,
        emailAndPassword: {
            enabled: true,
            minPasswordLength: 8,
            password: {
                hash: (password) => Bun.password.hash(password, { algorithm: 'argon2id' }),
                verify: ({ hash, password }) => Bun.password.verify(password, hash),
            },
        },
        socialProviders: google
            ? { google: { clientId: google.clientId, clientSecret: google.clientSecret, prompt: 'select_account' } }
            : {},
        plugins: [username({ minUsernameLength: USERNAME_MIN_LENGTH, maxUsernameLength: USERNAME_MAX_LENGTH })],
        rateLimit: { enabled: true, customRules: { '/sign-in/username': { window: 60, max: 10 } } },
        // Rate limits are per client IP. Behind Cloudflare → cloudflared → Traefik, X-Forwarded-For only
        // holds the tunnel's address (Traefik trusts no upstream), so every user would share one bucket;
        // Cloudflare's CF-Connecting-IP is the real client. Without Cloudflare (dev, e2e, self-hosts) it is
        // absent and X-Forwarded-For is used.
        advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] } },
        databaseHooks: {
            user: {
                create: {
                    // Fires once per new user row: password sign-up or a first Google sign-in (the only
                    // other user-creating flow configured here); ordinary sign-ins never reach it.
                    after: async (user, ctx) => {
                        logger?.info('User registered', {
                            userId: user.id,
                            username: user.username,
                            method: ctx?.path === '/sign-up/email' ? 'password' : 'google',
                        });
                    },
                },
            },
        },
        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                rejectEmailSignIn(ctx.path);

                if (ctx.path !== '/sign-up/email') return;
                const body = signUpBodySchema.parse(ctx.body);
                const name = body.username.trim();

                if (!name) throw new APIError('BAD_REQUEST', { message: 'Username is required' });

                // Never store a client-supplied email: an unverified real address would squat it and block that
                // person's later Google sign-in (account_not_linked).
                return {
                    context: {
                        ...ctx,
                        body: {
                            ...body,
                            email: `${crypto.randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
                            name,
                        },
                    },
                };
            }),
        },
    });

// Inferred rather than better-auth's generic `Auth`, which drops the username plugin's endpoints (`signInUsername`).
export type Auth = ReturnType<typeof createAuth>;
