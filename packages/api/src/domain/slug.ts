/**
 * Slug helpers used by the public discovery API and any other feature that needs a
 * stable, URL-safe identifier derived from a human-readable title.
 *
 * Conventions:
 *  - Output is lowercase kebab-case, ASCII-only (transliterated where reasonable).
 *  - Empty / non-alphanumeric input collapses to "untitled".
 *  - Length is bounded to 80 chars (room for a 6-char numeric suffix and stay under
 *    common URL-length limits).
 *  - Collisions are resolved by the caller; this module just produces a base.
 */

const MAX_LENGTH = 80;

const asciiFor = (ch: string): string => {
    // Common Latin-1 ligatures and accents that show up in recipe names.
    const map = new Map([
        ['æ', 'ae'],
        ['œ', 'oe'],
        ['ß', 'ss'],
        ['ø', 'o'],
        ['å', 'a'],
        ['đ', 'd'],
        ['ñ', 'n'],
    ]);

    const lower = ch.toLowerCase();

    const mapped = map.get(lower);

    if (mapped) return mapped;

    // Decompose accented characters and drop combining marks: "é" -> "e".
    return lower.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
};

export const slugify = (text: string): string => {
    const replaced = [...text]
        .map(asciiFor)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (!replaced) return 'untitled';

    return replaced.slice(0, MAX_LENGTH).replace(/-+$/g, '');
};

/**
 * Resolve a unique slug against an async predicate. If the base is taken, tries
 * `${base}-2`, `${base}-3`, ... up to 99 (9 999 for short bases). Returns the
 * first candidate for which `isTaken` is false. Bounded at 9 999 attempts so a
 * pathological collision does not loop forever; that bound is well past anything
 * the library could plausibly have.
 *
 * Pass `existing: DiscoveryRecipe['slug']` (the slug on the recipe being saved, if
 * any) to skip a self-collision when republishing the same recipe.
 */
// fallow-ignore-next-line complexity
export const uniqueSlug = async (
    base: string,
    isTaken: (candidate: string) => Promise<boolean>,
    existing?: string
): Promise<string> => {
    // A republish with a known slug keeps it, as long as no other recipe took it.
    if (existing?.startsWith(base) && !(await isTaken(existing))) {
        return existing;
    }

    // First try the bare base, then 2, 3, ... up to 9 999 (well past anything
    // the library could plausibly have).
    if (!(await isTaken(base))) return base;

    for (let n = 2; n < 10_000; n += 1) {
        const candidate = `${base}-${n}`;

        if (existing && candidate === existing) continue;

        if (!(await isTaken(candidate))) return candidate;
    }

    throw new Error(`Could not find a unique slug for "${base}" after 10 000 attempts`);
};
