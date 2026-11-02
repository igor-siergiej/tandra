#!/usr/bin/env bun

/**
 * Collect user-facing release notes for a release and record them in
 * packages/web/src/data/release-notes.json, which the web app bundles and shows
 * in its "What's new" panel.
 *
 * Notes come from the commits in the release range. A commit states its own
 * user-facing line with a `Release-Notes:` trailer in the commit body:
 *
 *     feat(web): Waste Warrior becomes a full page instead of a drawer
 *
 *     <technical body>
 *
 *     Release-Notes: Use-it-up ingredient search is now a full page, so results
 *     aren't squashed behind the keyboard.
 *
 * Commits without a trailer fall back to their conventional-commit subject, so
 * the panel is never empty regardless of who (or what) authored the commit.
 *
 * Usage: bun scripts/collect-release-notes.js <version> [<sinceRef>]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const NOTES_FILE = path.join(rootDir, 'packages', 'web', 'src', 'data', 'release-notes.json');

const FIELD_SEP = '\u001f';
const RECORD_SEP = '\u001e';

/** Conventional-commit types that describe a change a user can notice. */
const USER_FACING_TYPES = {
    feat: 'feature',
    fix: 'fix',
    perf: 'improvement',
};

const HEADER_PATTERN = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const TRAILER_PATTERN = /^release-notes:[ \t]*(.*)$/i;

/** Any other `Token: value` trailer line, which terminates a Release-Notes block. */
const OTHER_TRAILER_PATTERN = /^[A-Za-z][A-Za-z-]*:[ \t]/;

/**
 * Pull every `Release-Notes:` trailer out of a commit body. A squash-merge body
 * concatenates the messages of all its sub-commits, so it can carry several.
 * Each value may wrap over following lines and ends at a blank line, another
 * trailer, or the body's end. Returns an empty array when there are none.
 */
export const extractTrailers = (body) => {
    const lines = (body ?? '').split('\n');
    const texts = [];

    for (let index = 0; index < lines.length; index++) {
        const match = lines[index].trim().match(TRAILER_PATTERN);

        if (!match) continue;

        const parts = [match[1].trim()];

        while (index + 1 < lines.length) {
            const next = lines[index + 1].trim();

            if (next === '' || OTHER_TRAILER_PATTERN.test(next)) break;

            parts.push(next);
            index++;
        }

        const text = parts.filter(Boolean).join(' ').trim();

        if (text !== '') texts.push(text);
    }

    return texts;
};

/** Split a conventional-commit subject into its parts, or null if it isn't one. */
export const parseHeader = (subject) => {
    const match = (subject ?? '').trim().match(HEADER_PATTERN);

    if (!match) return null;

    const [, type, scope, breaking, description] = match;

    return { type: type.toLowerCase(), scope: scope ?? null, breaking: breaking === '!', description };
};

/** Turn a commit subject into a readable sentence: drop the PR ref, capitalise. */
export const tidySubject = (description) => {
    const withoutRef = description.replace(/\s*\(#\d+\)\s*$/, '').trim();

    return withoutRef.charAt(0).toUpperCase() + withoutRef.slice(1);
};

/**
 * Map one commit to its notes. Explicit trailers always win and always publish,
 * even on a commit type that is normally invisible (a `chore` that users can
 * genuinely see, say). Without any trailer, only user-facing types publish,
 * using their subject. A commit whose trailers are all filtered out later (see
 * `collectNotes`) does not fall back to its subject.
 */
export const commitToNotes = (commit) => {
    const header = parseHeader(commit.subject);

    if (!header) return [];

    // Release commits are semantic-release's own bookkeeping, never a note.
    if (header.type === 'chore' && header.scope === 'release') return [];

    const trailers = extractTrailers(commit.body);
    const type = USER_FACING_TYPES[header.type];

    if (trailers.length > 0) return trailers.map((text) => ({ type: type ?? 'improvement', text }));

    if (!type) return [];

    return [{ type, text: tidySubject(header.description) }];
};

/**
 * Notes for a set of commits, newest first. A line is dropped when it repeats
 * within this release or already appears in `published` (lowercased texts of
 * earlier releases), which is how a stacked branch's stale trailers stay out.
 */
export const collectNotes = (commits, published = new Set()) => {
    const seen = new Set(published);
    const notes = [];

    for (const commit of commits) {
        for (const note of commitToNotes(commit)) {
            const key = note.text.toLowerCase();

            if (seen.has(key)) continue;

            seen.add(key);
            notes.push(note);
        }
    }

    return notes;
};

const compareVersionsDesc = (a, b) => {
    const parse = (version) => version.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const [aMajor, aMinor, aPatch] = parse(a.version);
    const [bMajor, bMinor, bPatch] = parse(b.version);

    return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
};

/** Insert (or replace) a release entry, keeping the file newest-first. */
export const upsertRelease = (releases, entry) => {
    const others = releases.filter((release) => release.version !== entry.version);

    return [...others, entry].sort(compareVersionsDesc);
};

/** Lowercased note texts already published in releases older than `version`. */
export const publishedTexts = (releases, version) =>
    new Set(
        releases
            .filter((release) => compareVersionsDesc({ version }, release) < 0)
            .flatMap((release) => release.notes.map((note) => note.text.toLowerCase()))
    );

export const parseCommits = (raw) =>
    raw
        .split(RECORD_SEP)
        .map((record) => record.trim())
        .filter(Boolean)
        .map((record) => {
            const [hash, subject, body = ''] = record.split(FIELD_SEP);

            return { hash, subject, body };
        });

const readCommits = (sinceRef) => {
    const range = [];

    if (sinceRef) {
        try {
            execFileSync('git', ['rev-parse', '--verify', `${sinceRef}^{commit}`], { stdio: 'ignore' });
            range.push(`${sinceRef}..HEAD`);
        } catch {
            console.warn(`Ref "${sinceRef}" not found; collecting notes from the full history instead.`);
        }
    }

    const raw = execFileSync(
        'git',
        ['log', '--no-merges', `--format=%H${FIELD_SEP}%s${FIELD_SEP}%b${RECORD_SEP}`, ...range],
        { cwd: rootDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );

    return parseCommits(raw);
};

export const readReleases = (file = NOTES_FILE) => {
    if (!fs.existsSync(file)) return [];

    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));

    return Array.isArray(parsed) ? parsed : [];
};

export const writeReleases = (releases, file = NOTES_FILE) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(releases, null, 2)}\n`);
};

const main = () => {
    const [version, sinceRef] = process.argv.slice(2);

    if (!version) {
        console.error('Error: Version argument is required');
        console.error('Usage: bun scripts/collect-release-notes.js <version> [<sinceRef>]');
        process.exit(1);
    }

    const releases = readReleases();
    const notes = collectNotes(readCommits(sinceRef), publishedTexts(releases, version));

    if (notes.length === 0) {
        console.log(`No user-facing notes for ${version}; leaving release-notes.json unchanged.`);

        return;
    }

    const entry = { version, date: new Date().toISOString().slice(0, 10), notes };

    writeReleases(upsertRelease(releases, entry));

    console.log(`Recorded ${notes.length} release note(s) for ${version}`);
};

if (import.meta.main) main();
