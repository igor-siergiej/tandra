import { describe, expect, it } from 'bun:test';

import {
    collectNotes,
    commitToNotes,
    extractTrailers,
    parseCommits,
    publishedTexts,
    upsertRelease,
} from './collect-release-notes.js';

const commit = (subject, body = '') => ({ hash: 'abc1234', subject, body });

describe('extractTrailers', () => {
    it('joins a trailer that wraps over several lines', () => {
        const body = [
            'Some technical prose.',
            '',
            'Release-Notes: Recipe imports now show',
            'progress as they run.',
        ].join('\n');

        expect(extractTrailers(body)).toEqual(['Recipe imports now show progress as they run.']);
    });

    it('stops at the next trailer rather than swallowing it', () => {
        const body = [
            'Release-Notes: Dark mode remembers your choice.',
            'Co-authored-by: Someone <someone@example.com>',
        ].join('\n');

        expect(extractTrailers(body)).toEqual(['Dark mode remembers your choice.']);
    });

    it('returns an empty list when the trailer is absent or empty', () => {
        expect(extractTrailers('No trailer here.')).toEqual([]);
        expect(extractTrailers('Release-Notes:   ')).toEqual([]);
    });

    it('returns every trailer of a squash body in order, wrapped or not', () => {
        const body = [
            '* feat(web): first',
            '',
            'Release-Notes: The first line',
            'wraps over two lines.',
            '',
            '* fix(web): second',
            '',
            'Release-Notes: The second one is short.',
            '',
            '* fix(web): third',
            '',
            'Release-Notes: Third.',
            'Co-authored-by: Someone <someone@example.com>',
        ].join('\n');

        expect(extractTrailers(body)).toEqual([
            'The first line wraps over two lines.',
            'The second one is short.',
            'Third.',
        ]);
    });
});

describe('commitToNotes', () => {
    it('prefers the trailer over the commit subject', () => {
        const notes = commitToNotes(
            commit('feat(web): rework drawer into route', 'Release-Notes: Use-it-up search is now a full page.')
        );

        expect(notes).toEqual([{ type: 'feature', text: 'Use-it-up search is now a full page.' }]);
    });

    it('falls back to the subject, without scope or PR reference', () => {
        const notes = commitToNotes(commit('fix(web): widen recipes grid on desktop (#160)'));

        expect(notes).toEqual([{ type: 'fix', text: 'Widen recipes grid on desktop' }]);
    });

    it('publishes a normally invisible commit type when it carries a trailer', () => {
        const notes = commitToNotes(commit('chore: bump image sizes', 'Release-Notes: Photos load faster on mobile.'));

        expect(notes).toEqual([{ type: 'improvement', text: 'Photos load faster on mobile.' }]);
    });

    it('omits commits with no trailer and no user-facing type', () => {
        expect(commitToNotes(commit('chore: bump deps'))).toEqual([]);
        expect(commitToNotes(commit('test(web): add coverage for drawer'))).toEqual([]);
        expect(commitToNotes(commit('not a conventional commit'))).toEqual([]);
    });

    it("omits semantic-release's own release commits", () => {
        expect(
            commitToNotes(commit('chore(release): 1.73.0 [skip ci]', 'Release-Notes: should never surface'))
        ).toEqual([]);
    });
});

describe('collectNotes', () => {
    it('keeps commit order and drops repeated lines', () => {
        const notes = collectNotes([
            commit('feat(web): newest thing'),
            commit('fix(api): something', 'Release-Notes: Newest thing'),
            commit('fix(web): older fix'),
        ]);

        expect(notes).toEqual([
            { type: 'feature', text: 'Newest thing' },
            { type: 'fix', text: 'Older fix' },
        ]);
    });

    it('publishes only the new note of a stacked squash whose other trailers shipped earlier', () => {
        const body = [
            '* feat(web): recipe cards',
            '',
            'Release-Notes: Recipe cards show times.',
            '',
            '* fix(web): friend picker',
            '',
            'Release-Notes: The friend picker keeps the keyboard open.',
            '',
            '* fix(web): toasts',
            '',
            'Release-Notes: Toasts appear at the top.',
        ].join('\n');
        const published = new Set(['recipe cards show times.', 'the friend picker keeps the keyboard open.']);

        expect(collectNotes([commit('fix(web): toasts (#182)', body)], published)).toEqual([
            { type: 'fix', text: 'Toasts appear at the top.' },
        ]);
    });

    it('does not fall back to the subject when every trailer was already published', () => {
        const body = 'Release-Notes: Recipe cards show times.';

        expect(collectNotes([commit('fix(web): friend picker', body)], new Set(['recipe cards show times.']))).toEqual(
            []
        );
    });

    it('matches already published lines case-insensitively', () => {
        const published = new Set(['recipe cards show times.']);

        expect(collectNotes([commit('fix(web): x', 'Release-Notes: RECIPE CARDS SHOW TIMES.')], published)).toEqual([]);
    });
});

describe('publishedTexts', () => {
    const releases = [
        { version: '1.10.0', date: '2026-01-03', notes: [{ type: 'fix', text: 'Tenth' }] },
        { version: '1.9.0', date: '2026-01-02', notes: [{ type: 'fix', text: 'Ninth' }] },
        { version: '1.2.0', date: '2026-01-01', notes: [{ type: 'fix', text: 'Second' }] },
    ];

    it('gathers lowercased texts from strictly older releases only', () => {
        expect(publishedTexts(releases, '1.9.0')).toEqual(new Set(['second']));
        expect(publishedTexts(releases, '1.10.1')).toEqual(new Set(['tenth', 'ninth', 'second']));
    });
});

describe('parseCommits', () => {
    it('reads the multi-line bodies git log emits', () => {
        const raw = 'abc\u001ffeat: one\u001fRelease-Notes: First\nline two\u001e\ndef\u001ffix: two\u001f\u001e';

        expect(parseCommits(raw)).toEqual([
            { hash: 'abc', subject: 'feat: one', body: 'Release-Notes: First\nline two' },
            { hash: 'def', subject: 'fix: two', body: '' },
        ]);
    });
});

describe('upsertRelease', () => {
    it('replaces an existing version instead of duplicating it', () => {
        const releases = [{ version: '1.2.0', date: '2026-01-01', notes: [{ type: 'fix', text: 'Old' }] }];
        const updated = upsertRelease(releases, {
            version: '1.2.0',
            date: '2026-01-02',
            notes: [{ type: 'fix', text: 'New' }],
        });

        expect(updated).toEqual([{ version: '1.2.0', date: '2026-01-02', notes: [{ type: 'fix', text: 'New' }] }]);
    });

    it('orders releases newest-first numerically, not lexically', () => {
        const releases = [
            { version: '1.9.0', date: '2026-01-01', notes: [] },
            { version: '1.10.0', date: '2026-01-02', notes: [] },
        ];
        const updated = upsertRelease(releases, { version: '1.10.1', date: '2026-01-03', notes: [] });

        expect(updated.map((release) => release.version)).toEqual(['1.10.1', '1.10.0', '1.9.0']);
    });
});
