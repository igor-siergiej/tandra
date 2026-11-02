// Decides whether a newly-added shopping list item is "the same ingredient" as one
// already on the list, so ListService.addItems can combine quantities into a single
// row instead of creating near-duplicates (e.g. "eggs" and "large eggs" ending up as
// two separate lines). Deliberately narrow in scope: normalizes wording and a small
// set of count-unit synonyms, not a general unit-conversion engine (see
// packages/web/src/utils/convertUnits.ts for that, which is a display-time concern
// on the web side and out of scope here).

// Descriptive/size words stripped before comparing two ingredient names.
const DESCRIPTOR_WORDS: Record<string, true> = {
    large: true,
    small: true,
    medium: true,
    extra: true,
    jumbo: true,
    mini: true,
    fresh: true,
    frozen: true,
    raw: true,
    cooked: true,
    ripe: true,
    whole: true,
    ground: true,
    chopped: true,
    diced: true,
    minced: true,
    sliced: true,
    grated: true,
    plain: true,
    organic: true,
};

// Naive plural -> singular: strips a trailing "s" (but not "ss", to keep words like
// "swiss"/"cress" alone). Good enough for the short, mostly-English ingredient names
// this app deals with; not a general-purpose stemmer.
const singularize = (word: string): string =>
    word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;

export const normalizeIngredientName = (name: string): string =>
    name
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0 && !DESCRIPTOR_WORDS[word])
        .map(singularize)
        .join(' ');

// Unit strings that all mean "a bare count" — interchangeable with no unit at all for
// merge purposes (e.g. a recipe's "2 pcs" and a hand-typed "3" with no unit are the
// same 5-item quantity).
const COUNT_UNIT_SYNONYMS: Record<string, true> = {
    pcs: true,
    pc: true,
    piece: true,
    pieces: true,
    ea: true,
    each: true,
    unit: true,
    units: true,
    x: true,
};

const normalizeUnitForMerge = (unit?: string): string => {
    const trimmed = (unit ?? '').trim().toLowerCase();

    return COUNT_UNIT_SYNONYMS[trimmed] ? '' : trimmed;
};

export interface MergeableIngredient {
    name: string;
    unit?: string;
}

// Whether two items should be treated as the same shopping list row: names match
// after stripping descriptor words and singularizing, and units are the same
// measurement (or both count-like/blank) so quantities can be safely summed.
// Genuinely different units (e.g. "g" vs "ml") are left as separate rows.
export const isMergeableIngredient = (a: MergeableIngredient, b: MergeableIngredient): boolean =>
    normalizeIngredientName(a.name) === normalizeIngredientName(b.name) &&
    normalizeUnitForMerge(a.unit) === normalizeUnitForMerge(b.unit);

// Sums two optional quantities, staying undefined only when neither side tracked one.
export const resolveMergedQuantity = (existing?: number, incoming?: number): number | undefined => {
    if (existing === undefined && incoming === undefined) return undefined;

    return (existing ?? 0) + (incoming ?? 0);
};

// Keeps the existing item's unit label (already what the list displays); adopts the
// incoming one only if the existing item didn't have one at all.
export const resolveMergedUnit = (existing?: string, incoming?: string): string | undefined => existing ?? incoming;
