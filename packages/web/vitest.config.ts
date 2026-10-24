import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'virtual:pwa-register/react': path.resolve(__dirname, './src/__mocks__/pwa-register.ts'),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify('test'),
        // Matches the newest release in the Appbar test's mocked release notes.
        __LATEST_RELEASE__: JSON.stringify('1.3.0'),
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/test-setup.ts'],
        // Worker threads start faster than the default child processes; ~10-15% off a full run, same results.
        pool: 'threads',
        // date-fns ships hundreds of separate ESM files; Vite pre-bundles it for the app, but Vitest
        // otherwise loads each one, ~2s per test file that reaches it. Pre-bundling makes that one file.
        deps: { optimizer: { web: { enabled: true, include: ['date-fns'] } } },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'build/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
        },
    },
});
