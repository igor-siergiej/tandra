import { describe, expect, it } from 'bun:test';

import { assessImage } from './imageLicence';
import type { WikibooksImageInfo } from './types';

// Field values are taken from the live Wikibooks API (iiprop=extmetadata) for real cookbook pictures.
const info = (overrides: Partial<WikibooksImageInfo> = {}): WikibooksImageInfo => ({
    found: true,
    mime: 'image/jpeg',
    thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Baked_Ziti.jpg',
    descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Baked_Ziti.jpg',
    licenceShortName: 'CC BY 2.0',
    restrictions: '',
    artistHtml:
        '<a rel="nofollow" class="external text" href="https://www.flickr.com/people/59216116@N00">Jane Doe</a>',
    ...overrides,
});

describe('assessImage', () => {
    it.each([
        'CC BY 2.0',
        'CC BY 4.0',
        'CC BY-SA 3.0',
        'CC BY-SA 4.0',
        'CC BY-SA 2.0 fr',
        'CC BY-SA 3.0 at',
        'CC0',
        'CC0 1.0',
        'Public domain',
        'PD-self',
        'PD US',
    ])('accepts %s', (licence) => {
        expect(assessImage(info({ licenceShortName: licence }))).toMatchObject({ ok: true });
    });

    it.each([
        ['non-commercial', 'CC BY-NC 2.0'],
        ['no-derivatives', 'CC BY-ND 3.0'],
        ['non-commercial share-alike', 'CC BY-NC-SA 3.0'],
        ['GFDL only', 'GFDL 1.2'],
        ['a bare "Attribution" template', 'Attribution'],
        ['"Copyrighted free use"', 'Copyrighted free use'],
        ['fair use', 'Fair use'],
    ])('refuses a %s licence', (_label, licence) => {
        expect(assessImage(info({ licenceShortName: licence }))).toMatchObject({ ok: false });
    });

    it('refuses a picture that states no licence at all', () => {
        expect(assessImage(info({ licenceShortName: undefined }))).toEqual({ ok: false, reason: 'no licence stated' });
        expect(assessImage(info({ licenceShortName: '  ' }))).toEqual({ ok: false, reason: 'no licence stated' });
    });

    it('refuses a missing file, an unusable type and a legally restricted picture', () => {
        expect(assessImage(info({ found: false }))).toEqual({ ok: false, reason: 'file not found' });
        expect(assessImage(info({ mime: 'image/gif' }))).toMatchObject({ ok: false });
        expect(assessImage(info({ mime: 'image/svg+xml' }))).toMatchObject({ ok: false });
        expect(assessImage(info({ restrictions: 'trademarked' }))).toMatchObject({ ok: false });
        expect(assessImage(info({ thumbUrl: undefined }))).toMatchObject({ ok: false });
    });

    it('credits the author as plain text with the licence and where the picture is from', () => {
        expect(assessImage(info())).toEqual({
            ok: true,
            attribution: 'Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Baked_Ziti.jpg',
        });
    });

    it('says Wikibooks when the file lives on Wikibooks rather than Commons', () => {
        const result = assessImage(
            info({ descriptionUrl: 'https://en.wikibooks.org/wiki/File:Local.jpg', licenceShortName: 'CC BY-SA 3.0' })
        );

        expect(result).toMatchObject({ ok: true, attribution: expect.stringContaining('via Wikibooks') });
    });

    it('drops the Commons "no machine-readable author" boilerplate and keeps the name', () => {
        const result = assessImage(
            info({
                artistHtml:
                    'No machine-readable author provided. <a href="//commons.wikimedia.org/wiki/User:Ozten~commonswiki" title="User:Ozten~commonswiki">Ozten~commonswiki</a> assumed (based on copyright claims).',
            })
        );

        expect(result).toMatchObject({
            ok: true,
            attribution: 'Photo: Ozten~commonswiki, CC BY 2.0, via Wikimedia Commons',
        });
    });

    it('uses a plain-text artist as is, and "Unknown author" when there is none', () => {
        expect(assessImage(info({ artistHtml: 'jules' }))).toMatchObject({
            attribution: expect.stringContaining('Photo: jules,'),
        });
        expect(assessImage(info({ artistHtml: '' }))).toMatchObject({
            attribution: expect.stringContaining('Photo: Unknown author,'),
        });
        expect(assessImage(info({ artistHtml: undefined }))).toMatchObject({
            attribution: expect.stringContaining('Unknown author'),
        });
    });

    it('strips markup from the credit and caps an absurdly long author', () => {
        const result = assessImage(info({ artistHtml: `<b>${'A'.repeat(500)}</b><script>x()</script>` }));
        expect(result.ok && result.attribution).not.toContain('<');
        expect(result.ok && result.attribution.length).toBeLessThan(200);
        // A cut-off name says so, rather than ending mid-word as if it were whole.
        expect(result.ok && result.attribution).toContain('…, CC BY 2.0');
    });
});
