#!/usr/bin/env bun
// Fails when a change introduces TypeScript errors the repo did not already have.
//
// `tsc --noEmit` reports every pre-existing error as well, so it fails identically
// before and after any change and tells a coding agent nothing about the change it
// just made. This gate keeps a baseline of the errors the repo already carries and
// fails only on NEW ones, so the backlog stays visible without blocking every
// commit. Shrink the baseline as the backlog is paid off.
//
// Usage:
//   bun scripts/typecheck.js           # check against the baseline
//   bun scripts/typecheck.js --update  # rewrite the baseline from the current errors
//
// The baseline is keyed by file and error code, with a count per pair, so moving
// code around or rewording a message does not read as a new error.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'typecheck-baseline.json');
const TSC = join(ROOT, 'node_modules', '.bin', 'tsc');

// The projects that make up the app. Each has its own typecheck config: the build
// configs are project references, and `tsc --noEmit` on a project-reference config
// checks nothing at all.
export const PROJECTS = [
    { name: 'api', config: 'packages/api/tsconfig.typecheck.json' },
    { name: 'web', config: 'packages/web/tsconfig.typecheck.json' },
];

// `file.ts(12,5): error TS2345: message` and the positionless `file.ts: error TS1: message`.
const ERROR_WITH_POSITION = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const ERROR_WITHOUT_POSITION = /^(.+?): error (TS\d+): (.*)$/;

/** Parses `tsc --pretty false` output into one entry per error. */
export const parseErrors = (output) => {
    const errors = [];

    for (const line of output.split('\n')) {
        const withPosition = ERROR_WITH_POSITION.exec(line);

        if (withPosition) {
            const [, file, lineNumber, column, code, message] = withPosition;
            errors.push({ file, line: Number(lineNumber), column: Number(column), code, message });
            continue;
        }

        const withoutPosition = ERROR_WITHOUT_POSITION.exec(line);

        if (withoutPosition) {
            const [, file, code, message] = withoutPosition;
            errors.push({ file, line: 0, column: 0, code, message });
        }
    }

    return errors;
};

/** Groups errors by `file::code` so the baseline can hold a count per pair. */
export const tally = (errors) => {
    const counts = new Map();

    for (const error of errors) {
        const key = `${error.file}::${error.code}`;
        const existing = counts.get(key);

        if (existing) existing.push(error);
        else counts.set(key, [error]);
    }

    return counts;
};

/**
 * Compares the current errors against the baseline.
 *
 * Returns the error groups that grew (new errors to fix) and the ones that shrank
 * (the backlog went down, so the baseline can be tightened).
 */
export const diff = (current, baseline) => {
    const added = [];
    const fixed = [];

    for (const [key, errors] of current) {
        const allowed = baseline[key] ?? 0;

        if (errors.length > allowed) added.push({ key, allowed, errors: errors.slice(allowed) });
    }

    for (const [key, allowed] of Object.entries(baseline)) {
        const actual = current.get(key)?.length ?? 0;

        if (actual < allowed) fixed.push({ key, allowed, actual });
    }

    return { added, fixed };
};

/** Runs `tsc` for one project and returns its errors. */
export const checkProject = (project) => {
    const result = spawnSync(TSC, ['-p', project.config, '--noEmit', '--pretty', 'false'], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });

    if (result.error) throw result.error;

    // tsc exits non-zero when it finds errors; that is the normal case here.
    if (result.status !== 0 && result.status !== 1 && result.status !== 2) {
        throw new Error(`tsc failed for ${project.name} (exit ${result.status}): ${result.stderr}`);
    }

    return parseErrors(`${result.stdout}\n${result.stderr}`);
};

export const loadBaseline = (path = BASELINE_PATH) => {
    if (!existsSync(path)) return {};

    return JSON.parse(readFileSync(path, 'utf8'));
};

export const saveBaseline = (counts, path = BASELINE_PATH) => {
    const baseline = {};

    for (const key of [...counts.keys()].sort()) baseline[key] = counts.get(key).length;
    writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`);

    return baseline;
};

if (import.meta.main) {
    const update = process.argv.includes('--update');
    const allErrors = [];

    for (const project of PROJECTS) {
        const errors = checkProject(project);
        allErrors.push(...errors);
        console.log(`Type-check ${project.name}: ${errors.length} error${errors.length === 1 ? '' : 's'}`);
    }

    const current = tally(allErrors);
    const baseline = loadBaseline();

    if (update) {
        const saved = saveBaseline(current);
        const total = Object.values(saved).reduce((sum, count) => sum + count, 0);
        console.log(
            `✅ Baseline updated: ${total} known error${total === 1 ? '' : 's'} across ${Object.keys(saved).length} files`
        );
        process.exit(0);
    }

    const { added, fixed } = diff(current, baseline);
    const knownTotal = Object.values(baseline).reduce((sum, count) => sum + count, 0);
    const currentTotal = [...current.values()].reduce((sum, errors) => sum + errors.length, 0);

    for (const { key, allowed, errors } of added) {
        console.error(`\n❌ New type error in ${key} (baseline allows ${allowed})`);

        for (const error of errors) {
            const where = error.line ? `:${error.line}:${error.column}` : '';
            console.error(`   ${error.file}${where} ${error.code}: ${error.message}`);
        }
    }

    for (const { key, allowed, actual } of fixed) {
        console.log(`✅ Fixed ${key} (${allowed} → ${actual})`);
    }

    if (added.length > 0) {
        console.error(
            `\n❌ ${added.length} new type error group${added.length === 1 ? '' : 's'} introduced by this change`
        );
        console.error(`   (${currentTotal} errors in total, ${knownTotal} of them already in the baseline)`);
        process.exit(1);
    }

    console.log(
        `\n✅ No new type errors (${currentTotal} known error${currentTotal === 1 ? '' : 's'}, all in the baseline)`
    );
}
