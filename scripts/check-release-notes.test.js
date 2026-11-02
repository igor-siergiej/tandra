import { describe, expect, it } from 'bun:test';

import { check } from './check-release-notes.js';

describe('check', () => {
    it('accepts a user-facing commit with a trailer', () => {
        const message = [
            'feat(web): add the heatmap preview',
            '',
            'The dashboard frames the app and gets placeholder data.',
            '',
            'Release-Notes: The analytics dashboard now shows a preview of the app.',
        ].join('\n');

        expect(check(message)).toEqual([]);
    });

    it('rejects a user-facing commit with no trailer', () => {
        const message = ['feat(web): add the heatmap preview', '', 'The dashboard frames the app.'].join('\n');

        expect(check(message)).toHaveLength(1);
        expect(check(message)[0]).toContain('no "Release-Notes:" trailer');
    });

    it('rejects a fix with no trailer', () => {
        const message = ['fix(web): keep todos private', '', 'A body with no trailer.'].join('\n');

        expect(check(message)).toHaveLength(1);
    });

    it('rejects an empty trailer', () => {
        const message = ['feat(web): add a thing', '', 'Release-Notes:'].join('\n');

        expect(check(message)[0]).toContain('empty');
    });

    it('accepts a chore commit with no trailer', () => {
        const message = ['chore(release): 2.4.0 [skip ci]', '', 'Automated release.'].join('\n');

        expect(check(message)).toEqual([]);
    });

    it('accepts a test commit with no trailer', () => {
        expect(check('test(e2e): keep e2e traffic out of Umami\n\nA body.')).toEqual([]);
    });

    it('accepts a docs commit with no trailer', () => {
        expect(check('docs: fix a typo in the readme\n\nA body.')).toEqual([]);
    });

    it('accepts a message that is not a conventional commit', () => {
        expect(check('some random message\n\nA body.')).toEqual([]);
    });

    it('accepts a trailer that continues over several lines', () => {
        const message = [
            'feat(web): add the thing',
            '',
            'Release-Notes: The thing now exists and it is',
            'much easier to use.',
        ].join('\n');

        expect(check(message)).toEqual([]);
    });

    it('finds the trailer after other trailers', () => {
        const message = [
            'feat(web): add the thing',
            '',
            'Signed-off-by: Someone <someone@example.com>',
            '',
            'Release-Notes: The thing now exists.',
        ].join('\n');

        expect(check(message)).toEqual([]);
    });
});
