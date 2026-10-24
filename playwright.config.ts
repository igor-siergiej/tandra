import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolveMongoUri } from './e2e/mongo-uri';
import { allStacks, E2E_WORKERS } from './e2e/stack';

config();

const E2E_MONGO_URI = resolveMongoUri();

// Live smoke checks (e.g. kanban-cli e2e live) inject a deployed URL via
// E2E_BASE_URL; honour it so the smoke spec actually targets prod instead
// of silently falling back to the dev server. Local runs leave the env
// unset and keep :4000.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4000';

export default defineConfig({
    testDir: './e2e/tests',
    tsconfig: './e2e/tsconfig.json',
    // Safe because every test sets up its own state and each worker has its own stack (e2e/stack.ts); it also lets
    // --shard split by test rather than by file. Tests that must share a worker and run in order can opt in with
    // test.describe.configure({ mode: 'serial' }).
    fullyParallel: true,
    workers: E2E_WORKERS,
    timeout: 8000,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'html',
    globalSetup: './e2e/global-setup.ts',
    expect: {
        toHaveScreenshot: {
            animations: 'disabled',
            maxDiffPixelRatio: 0.02,
        },
    },
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        serviceWorkers: 'block',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: /.*\.visual\.spec\.ts/,
        },
        {
            name: 'mobile-visual',
            use: { ...devices['Pixel 7'] },
            testMatch: /.*\.visual\.spec\.ts/,
            timeout: 15000,
        },
        {
            name: 'desktop-visual',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /.*\.visual\.spec\.ts/,
            timeout: 15000,
            // Desktop screens are mostly empty background, so the global 2%
            // ratio (of a much larger 1280x720 canvas) is a looser absolute
            // pixel budget than it is for the smaller mobile viewport — use
            // a flat pixel cap here instead, roughly matching the mobile
            // project's effective budget, so a real component-level shift
            // can't hide under a ratio that's loose only because the canvas
            // is big. Repeats `animations: 'disabled'` rather than relying
            // on it merging in from the global `expect` block above.
            expect: {
                toHaveScreenshot: {
                    animations: 'disabled',
                    maxDiffPixels: 4000,
                },
            },
        },
    ],
    // Servers start in order, each waiting for the previous one to be ready, so slot 0 builds the bundle once and
    // later slots only serve it.
    webServer: allStacks().flatMap((stack, slot) => [
        {
            // A prebuilt bundle, not the Vite dev server: every test opens a fresh browser context, and the dev
            // server makes each one fetch and transform the whole unbundled module graph again. A running dev
            // server is still reused locally.
            command: `${slot === 0 ? 'bun run build:e2e && ' : ''}bunx vite preview --port ${stack.webPort} --strictPort --outDir build-e2e`,
            cwd: 'packages/web',
            url: stack.webOrigin,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { E2E_API_PROXY_TARGET: stack.apiBase },
        },
        {
            command: 'bun run --filter @tandra/api start:e2e',
            url: `${stack.apiBase}/api/health`,
            reuseExistingServer: false,
            env: {
                PORT: String(stack.apiPort),
                // Fixed test values, never a developer's .env: e2e signs in through these.
                BETTER_AUTH_SECRET: 'e2e-better-auth-secret-not-for-prod-32+',
                BETTER_AUTH_URL: stack.webOrigin,
                CONNECTION_URI: E2E_MONGO_URI,
                DATABASE_NAME: stack.dbName,
                BUCKET_ENDPOINT: 'localhost:9000',
                BUCKET_NAME: 'tandra',
                BUCKET_ACCESS_KEY: 'rustfsadmin',
                BUCKET_SECRET_KEY: 'rustfsadmin',
                // Only the dedicated e2e search engine, never a developer's OPENSEARCH_URL from .env. Empty = discovery off.
                OPENSEARCH_URL: process.env.E2E_OPENSEARCH_URL ?? '',
                OPENSEARCH_INDEX: stack.discoveryIndex,
                // The public read endpoint echoes the allow-listed origin in Access-Control-Allow-Origin.
                // Without an allow-list the middleware falls back to "*"; the test asserts the echo path.
                PUBLIC_DISCOVER_ORIGINS: 'https://tandra.uk',
            },
        },
    ]),
});
