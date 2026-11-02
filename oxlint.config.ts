import base from '@imapps/oxc-config/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig({
    ...base,
    ignorePatterns: [
        ...(base.ignorePatterns ?? []),
        '**/.design-sync/**',
        '**/.github/workflows-utils/**',
        'packages/web/.design-sync-fonts/**',
        'packages/web/.design-sync-theme/**',
        'e2e/mocks/data/umami-tracker.js',
    ],
});
