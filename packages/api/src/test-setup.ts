process.env.PORT = '3000';

process.env.CONNECTION_URI = 'mongodb://localhost:27017/test';

process.env.DATABASE_NAME = 'test';

process.env.BUCKET_NAME = 'test';

process.env.BUCKET_ACCESS_KEY = 'test';

process.env.BUCKET_SECRET_KEY = 'test';

process.env.BUCKET_ENDPOINT = 'localhost:9000';

process.env.FAL_KEY = 'test-key';

process.env.GEMINI_API_KEY = 'test-gemini-key';

// Required for `config.get('betterAuthSecret')` and `'betterAuthUrl')` to resolve during the DI
// singleton factories at boot. Tests that exercise Better Auth construct their own `createAuth`
// with their own secret/baseURL; the api itself never resolves DependencyToken.Auth without these.
process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-123';

process.env.BETTER_AUTH_URL = 'http://localhost:3000';

// Backstop for tests that forget to stub fetch: the AI hosts are never reachable from a test run (sandbox, CI or a
// developer machine), so a missed stub fails loudly instead of sending a real request. Tests that stub
// `global.fetch` replace this wrapper for their own file, which is fine because they stub the call themselves.
const GUARDED_HOST = /(^|\.)fal\.run$|^generativelanguage\.googleapis\.com$/;

const originalFetch = globalThis.fetch;

const hostnameOf = (input: Parameters<typeof fetch>[0]): string | undefined => {
    try {
        return new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname;
    } catch {
        return undefined;
    }
};

const guardedFetch = ((input, init) => {
    const host = hostnameOf(input);

    if (host !== undefined && GUARDED_HOST.test(host)) {
        return Promise.reject(new Error(`Blocked test request to ${host}: stub fetch in this test`));
    }

    return originalFetch(input, init);
}) as typeof fetch;

globalThis.fetch = Object.assign(guardedFetch, originalFetch);
