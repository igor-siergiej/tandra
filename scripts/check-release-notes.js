#!/usr/bin/env bun
// Fails a commit that a user would notice but that carries no `Release-Notes:` trailer.
//
// `AGENTS.md` requires the trailer on every user-visible change, but nothing checked it:
// a missing trailer was only discovered at release time, when `scripts/collect-release-notes.js`
// silently fell back to the commit subject and the "What's new" panel showed a commit log.
// This runs from the `commit-msg` hook so the author finds out before the commit exists.
//
// Usage:
//   bun scripts/check-release-notes.js <commit-message-file>
//
// The parsing comes from `collect-release-notes.js` itself, so this check and the release
// notes can never disagree about what counts as a trailer.
import { readFileSync } from 'node:fs';

import { extractTrailers, parseHeader } from './collect-release-notes.js';

/** Commit types whose changes a user can notice, matching the release-notes collector. */
export const USER_FACING_TYPES = new Set(['feat', 'fix', 'perf']);

/** A `Release-Notes:` line with nothing after it. */
const EMPTY_TRAILER = /^\s*release-notes:[ \t]*$/i;

/**
 * Checks a commit message.
 *
 * Returns the problems found: an empty list means the message is acceptable.
 */
export const check = (message) => {
    const problems = [];
    const [subject = '', ...bodyLines] = message.split('\n');
    const header = parseHeader(subject);

    // A message that is not a conventional commit has no place for a trailer, and
    // commitlint rejects those separately.
    if (!header) return problems;

    const body = bodyLines.join('\n');
    const trailers = extractTrailers(body);

    // A trailer on any other type forces the commit into the notes, which is allowed.
    if (!USER_FACING_TYPES.has(header.type)) return problems;

    if (trailers.length === 0) {
        // An empty trailer reads as no trailer at all to the collector, so say which it was.
        if (bodyLines.some((line) => EMPTY_TRAILER.test(line))) {
            problems.push('The "Release-Notes:" trailer is empty. Describe the change from the user\'s side.');
        } else {
            problems.push(
                `This is a "${header.type}" commit, so a user can notice it, but it has no "Release-Notes:" trailer.`
            );
        }

        return problems;
    }

    return problems;
};

if (import.meta.main) {
    const file = process.argv[2];

    if (!file) {
        console.error('Usage: bun scripts/check-release-notes.js <commit-message-file>');
        process.exit(2);
    }

    const problems = check(readFileSync(file, 'utf8'));

    if (problems.length > 0) {
        console.error('\n❌ Release notes are missing from this commit:\n');

        for (const problem of problems) console.error(`   ${problem}`);
        console.error('\n   Add a trailer at the end of the commit body, one sentence in plain language:');
        console.error('\n   Release-Notes: Usage stats no longer include your list names.\n');
        process.exit(1);
    }
}
