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
    rules: {
        ...base.rules,
        // Biome's useSemanticElements was a warning here, not an error.
        'jsx-a11y/prefer-tag-over-role': 'warn',
        // Biome's noAutofocus only looked at DOM elements; the app's own <Input autoFocus> components are intentional
        // (a drawer or inline editor that opens in response to the user's tap).
        'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
    },
});
