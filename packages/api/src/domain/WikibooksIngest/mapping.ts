import type { RecipeDifficulty } from '@tandra/types';

export const WIKIBOOKS_LICENCE = 'CC-BY-SA-4.0';
const WIKI_ARTICLE_URL = 'https://en.wikibooks.org/wiki/';
const COOKBOOK_PREFIX = /^Cookbook:/i;

/** Longest plausible cooking time; anything above is a typo in the source and is estimated instead. */
const MAX_MINUTES = 7 * 24 * 60;
const MAX_SERVINGS = 100;

/** Wikibooks rates difficulty 1-5: 1 easy, 2-3 medium, 4-5 hard. Anything else is unknown. */
// One branch per rating band.
// fallow-ignore-next-line complexity
export const mapDifficulty = (raw: string | undefined): RecipeDifficulty | undefined => {
    const level = /\d+/.exec(raw ?? '')?.[0];
    if (level === undefined) return undefined;
    const value = Number(level);
    if (value === 1) return 'easy';
    if (value === 2 || value === 3) return 'medium';
    if (value === 4 || value === 5) return 'hard';
    return undefined;
};

/** `Dessert_recipes` / `Nigerian recipes` / `Recipes for dessert` -> `dessert` / `nigerian` / `dessert`. */
export const cleanCategory = (raw: string | undefined): string | undefined => {
    const cleaned = (raw ?? '')
        .replace(/^.*Category:/i, '')
        .replace(/[\u200e\u200f]/g, '')
        .replace(/_/g, ' ')
        .replace(/^recipes\s+(?:for|using|with)\s+/i, '')
        .replace(/\s+recipes?$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return cleaned || undefined;
};

/** Free text like `About 6`, `8-10`, `8 pieces`: the first number, the conservative end of a range. */
// Bounds check on a free-text number.
// fallow-ignore-next-line complexity
export const parseServings = (raw: string | undefined): number | undefined => {
    const first = /\d+/.exec(raw ?? '')?.[0];
    if (first === undefined) return undefined;
    const value = Number(first);
    return value >= 1 && value <= MAX_SERVINGS ? value : undefined;
};

const DURATION_PART = /(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)\b/gi;

const toMinutes = (amount: number, unit: string): number => {
    const first = unit.charAt(0).toLowerCase();
    if (first === 'd') return amount * 24 * 60;
    if (first === 'h') return amount * 60;
    return amount;
};

/** Sums every `<n> <unit>` in a segment ("1 hour 30 minutes", "8 h, 10 minutes"); a range counts at its upper end. */
const minutesIn = (segment: string): number => {
    let total = 0;
    for (const match of segment.matchAll(DURATION_PART)) {
        const [, low, high, unit] = match;
        total += toMinutes(Number(high ?? low), unit ?? 'm');
    }
    return Math.round(total);
};

const PREP_LABEL = /^\s*prep(?:aration)?\b/i;
const TOTAL_LABEL = /^\s*total\b/i;

const VULGAR_FRACTIONS: Record<string, string> = { '½': '.5', '¼': '.25', '¾': '.75' };

// "1½ hours" -> "1.5 hours", "½ hour" -> "0.5 hour"
const withDecimalFractions = (text: string): string =>
    text.replace(
        /(\d?)([½¼¾])/g,
        (_, whole: string, fraction: string) => `${whole || '0'}${VULGAR_FRACTIONS[fraction]}`
    );

export interface SourceTimes {
    prepTime?: number;
    cookTime?: number;
}

/**
 * The infobox has ONE free-text `time`. Labelled segments ("Prep: 20 minutes", "Baking: 60 minutes") are split into
 * prep and cook; an unlabelled or "Total" value is a single total and goes to `cookTime`, leaving `prepTime` unset.
 * A "Total" segment next to labelled parts only repeats them, so it is ignored there.
 */
// Label classification over free-text segments.
// fallow-ignore-next-line complexity
export const parseTimes = (raw: string | undefined): SourceTimes => {
    let prep = 0;
    let cook = 0;
    let total = 0;
    for (const segment of withDecimalFractions(raw ?? '').split(/[\n;]+/)) {
        const minutes = minutesIn(segment);
        if (minutes === 0) continue;
        if (PREP_LABEL.test(segment)) prep += minutes;
        else if (TOTAL_LABEL.test(segment)) total += minutes;
        else cook += minutes;
    }
    const cookTime = cook > 0 || prep > 0 ? cook : total;
    return {
        ...(prep > 0 && prep <= MAX_MINUTES && { prepTime: prep }),
        ...(cookTime > 0 && cookTime <= MAX_MINUTES && { cookTime }),
    };
};

/** The recipe's name without the wiki namespace. */
export const recipeTitle = (pageTitle: string): string => pageTitle.replace(COOKBOOK_PREFIX, '').trim();

export const pageUrl = (pageTitle: string): string =>
    `${WIKI_ARTICLE_URL}${encodeURIComponent(pageTitle.replace(/ /g, '_')).replace(/%3A/g, ':')}`;

export const attributionFor = (pageTitle: string): string =>
    `"${recipeTitle(pageTitle)}" from Wikibooks Cookbook, CC BY-SA 4.0 (${pageUrl(pageTitle)})`;

/** A Wikibooks recipe's library id; it doubles as its public URL slug. */
export const recipeIdFor = (pageId: number): string => `wikibooks-${pageId}`;

/** The shape of every Wikibooks recipe id, and so of its slug, whether or not that page has been ingested yet. */
export const WIKIBOOKS_RECIPE_ID = /^wikibooks-\d+$/;
