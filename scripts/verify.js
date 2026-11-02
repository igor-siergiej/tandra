#!/usr/bin/env bun
// One command that tells a coding agent whether its change is good.
//
// Every check in this repo used to be a separate incantation with its own failure
// mode, and several of them silently passed (the root `tsc --noEmit` type-checks
// nothing at all). An agent that ran the wrong one got a green tick and no
// information. This runs the real gates in the order that fails fastest, stops at
// the first failure, and prints what to do about it.
//
// Usage:
//   bun scripts/verify.js         # lint, type-check, unit tests
//   bun scripts/verify.js --fast  # lint and type-check only
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Each step names the command to run and the fix when it fails.
const STEPS = [
    {
        name: 'lint',
        command: ['bun', 'run', 'lint'],
        hint: 'Run `bun run lint:fix` to auto-fix what it can, then fix the rest by hand.',
    },
    {
        name: 'type-check',
        command: ['bun', 'scripts/typecheck.js'],
        hint: 'Fix the new type errors it lists. `bun scripts/typecheck.js --update` re-baselines the known backlog.',
    },
    {
        name: 'api tests',
        command: ['bun', 'run', '--filter', '@tandra/api', 'test'],
        hint: 'Run `bun run --filter @tandra/api test` alone to see the failing assertions.',
    },
    {
        name: 'web tests',
        command: ['bun', 'run', '--filter', '@tandra/web', 'test'],
        hint: 'Run `bun run --filter @tandra/web test` alone to see the failing assertions.',
    },
    {
        name: 'script tests',
        command: ['bun', 'run', 'test:scripts'],
        hint: 'Run `bun run test:scripts` alone to see the failing assertions.',
    },
];

const run = (command) => spawnSync(command[0], command.slice(1), { cwd: ROOT, stdio: 'inherit' });

const flag = (name) => process.argv.includes(name);

if (import.meta.main) {
    const steps = flag('--fast') ? STEPS.filter((step) => !step.name.includes('tests')) : STEPS;

    console.log(`Verifying the change (${steps.length} checks)\n`);

    for (const [index, step] of steps.entries()) {
        console.log(`── ${index + 1}/${steps.length} ${step.name} ${'─'.repeat(Math.max(0, 40 - step.name.length))}`);
        const result = run(step.command);

        if (result.status !== 0) {
            console.error(`\n❌ ${step.name} failed (exit ${result.status}).`);
            console.error(`   ${step.hint}`);
            process.exit(result.status ?? 1);
        }

        console.log('');
    }

    console.log('✅ All checks passed');
}
