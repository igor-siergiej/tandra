import * as cheerio from 'cheerio';

import type { WikibooksImageInfo } from './types';

export type ImageAssessment = { ok: true; attribution: string; sourceUrl: string } | { ok: false; reason: string };

// Only licences that allow reuse with credit. Anything else, including "no licence stated", is refused: a picture is
// shown only when we can say why we may show it.
const REUSABLE_LICENCE = /^(?:CC BY(?:-SA)? \d\.\d(?: [a-z]{2})?|CC0(?: .*)?|Public domain|PD(?:[- ].*)?)$/i;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AUTHOR_LENGTH = 120;
const UNKNOWN_AUTHOR = 'Unknown author';

const MACHINE_READABLE_PREFIX = /^No machine-readable author provided\.\s*/i;
const ASSUMED_SUFFIX = /\s*assumed \(based on copyright claims\)\.?$/i;

/** The author as a person would write it: markup gone, Commons' "no machine-readable author" boilerplate trimmed. */
const authorName = (artistHtml: string | undefined): string => {
    const text = cheerio
        .load(artistHtml ?? '')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(MACHINE_READABLE_PREFIX, '')
        .replace(ASSUMED_SUFFIX, '')
        .trim();

    if (!text) return UNKNOWN_AUTHOR;

    return text.length > MAX_AUTHOR_LENGTH ? `${text.slice(0, MAX_AUTHOR_LENGTH).trimEnd()}…` : text;
};

const via = (descriptionUrl: string): string =>
    new URL(descriptionUrl).hostname.includes('commons') ? 'Wikimedia Commons' : 'Wikibooks';

/** Whether a Wikibooks picture may be shown with a recipe, and if so the credit that must accompany it. */
// One refusal per way a picture can be unusable, then the credit.
// fallow-ignore-next-line complexity
export const assessImage = (info: WikibooksImageInfo): ImageAssessment => {
    if (!info.found) return { ok: false, reason: 'file not found' };

    if (!(info.thumbUrl && info.descriptionUrl)) return { ok: false, reason: 'no downloadable rendition' };

    if (!(info.mime && ALLOWED_MIME.has(info.mime))) return { ok: false, reason: `unsupported type ${info.mime}` };
    const licence = info.licenceShortName?.trim();

    if (!licence) return { ok: false, reason: 'no licence stated' };

    if (!REUSABLE_LICENCE.test(licence)) return { ok: false, reason: `licence not reusable: ${licence}` };

    if (info.restrictions?.trim()) return { ok: false, reason: `restricted: ${info.restrictions.trim()}` };

    return {
        ok: true,
        attribution: `Photo: ${authorName(info.artistHtml)}, ${licence}, via ${via(info.descriptionUrl)}`,
        sourceUrl: info.descriptionUrl,
    };
};
