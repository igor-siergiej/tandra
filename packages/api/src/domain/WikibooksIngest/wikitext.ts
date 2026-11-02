/**
 * Reads a Wikibooks Cookbook page's wikitext into the pieces a library recipe needs: the infobox parameters, the
 * ingredient lines and the procedure steps. Pure and total: a page that is not a usable recipe yields `null`.
 */

export interface ParsedWikibooksPage {
    /** Infobox (`{{Recipe summary}}`) parameters, lowercased names, raw (wikitext-stripped) values. */
    infobox: Record<string, string>;
    /** The infobox's cover picture as a wiki file name (`Baked Ziti.jpg`), when it names a jpg, png or webp. */
    image?: string;
    ingredientLines: string[];
    instructions: string[];
}

const NAMED_ENTITIES: Record<string, string> = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    deg: '°',
    frac12: '½',
    frac14: '¼',
    frac34: '¾',
    ndash: '–',
    mdash: '—',
    times: '×',
    rsquo: '’',
    lsquo: '‘',
    frasl: '⁄',
};

const INGREDIENTS_HEADING = /^ingredients?:?$/i;

// In priority order; a heading may carry a qualifier ("Procedure (brief)").
const PROCEDURE_HEADINGS = [/^procedures?\b/i, /^directions\b/i, /^instructions\b/i, /^method\b/i, /^preparation\b/i];
const INFOBOX_START = /\{\{\s*recipe\s*summary\b/i;
const CONVERT_TEMPLATE = /^convert$/i;

const decodeEntities = (text: string): string =>
    text
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&([a-z0-9]+);/gi, (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole);

/** Index just past the `}}` that closes the `{{` at `start`, honouring nesting; -1 when unbalanced. */
// Nesting scan over two-character delimiters.
// fallow-ignore-next-line complexity
const closingBraces = (text: string, start: number): number => {
    let depth = 0;

    for (let i = start; i < text.length - 1; i += 1) {
        const pair = text.slice(i, i + 2);

        if (pair === '{{') {
            depth += 1;
            i += 1;
        } else if (pair === '}}') {
            depth -= 1;
            i += 1;

            if (depth === 0) return i + 1;
        }
    }

    return -1;
};

/** Splits on `|` outside nested `{{ }}` and `[[ ]]`. */
// Nesting-aware split over two-character delimiters.
// fallow-ignore-next-line complexity
const splitTopLevel = (body: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < body.length; i += 1) {
        const two = body.slice(i, i + 2);

        if (two === '{{' || two === '[[') {
            depth += 1;
            current += two;
            i += 1;
        } else if (two === '}}' || two === ']]') {
            depth -= 1;
            current += two;
            i += 1;
        } else if (body[i] === '|' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += body[i];
        }
    }

    parts.push(current);

    return parts;
};

/** `{{convert|1|cup|ml}}` keeps the stated measurement; every other template carries no recipe text. */
const renderTemplate = (inner: string): string => {
    const [name, ...args] = splitTopLevel(inner).map((part) => part.trim());

    return CONVERT_TEMPLATE.test(name ?? '') && args.length >= 2 ? `${args[0]} ${args[1]}` : '';
};

const stripTemplates = (text: string): string => {
    let out = '';
    let i = 0;

    while (i < text.length) {
        if (text.startsWith('{{', i)) {
            const end = closingBraces(text, i);

            if (end === -1) break;
            out += renderTemplate(stripTemplates(text.slice(i + 2, end - 2)));
            i = end;
        } else {
            out += text[i];
            i += 1;
        }
    }

    return out;
};

/** Markup removed, plain text left; whitespace collapsed. */
// One regex pass per kind of wikitext markup.
// fallow-ignore-next-line complexity
const plainText = (wikitext: string): string =>
    decodeEntities(
        stripTemplates(wikitext)
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
            .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
            .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
            .replace(/\[\[(?:Cookbook:)?([^\]]*)\]\]/gi, '$1')
            .replace(/\[(?:https?:)?\/\/\S+\s+([^\]]*)\]/g, '$1')
            .replace(/\[(?:https?:)?\/\/\S+\]/g, '')
            .replace(/'{2,}/g, '')
            .replace(/<\/?br\s*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, '')
    )
        .replace(/\s+/g, ' ')
        .trim();

// `[[File:Foo bar.jpg|300px]]`, `[[Image:Foo.JPG`, `File:Foo.png` or a bare `Foo.jpg`. Only formats a browser can show.
const IMAGE_FILE = /^\s*(?:\[\[\s*)?(?:(?:file|image)\s*:\s*)?([^|\]\n]+?\.(?:jpe?g|png|webp))\s*(?:[|\]][\s\S]*)?$/i;

const imageFileName = (rawValue: string): string | undefined => {
    const match = IMAGE_FILE.exec(rawValue.replace(/<!--[\s\S]*?-->/g, ''));

    return match?.[1]?.replace(/_/g, ' ').trim() || undefined;
};

interface ParsedInfobox {
    params: Record<string, string>;
    image?: string;
}

// Locates the template, then reads each parameter defensively.
// fallow-ignore-next-line complexity
const parseInfobox = (wikitext: string): ParsedInfobox => {
    const start = wikitext.search(INFOBOX_START);

    if (start === -1) return { params: {} };
    const end = closingBraces(wikitext, start);

    if (end === -1) return { params: {} };

    const [, ...params] = splitTopLevel(wikitext.slice(start + 2, end - 2));
    const infobox: Record<string, string> = {};
    let image: string | undefined;

    for (const param of params) {
        const equals = param.indexOf('=');

        if (equals === -1) continue;
        const name = param.slice(0, equals).trim().toLowerCase();
        const raw = param.slice(equals + 1);

        // The picture is a wiki link, which plainText() would strip, so it is read from the raw value.
        if (name === 'image') image ??= imageFileName(raw);
        // Keep `<br>` as a `;` separator: a time like "Prep: 10 min<br/>Cooking: 5 min" is two values.
        const value = plainText(raw.replace(/<\/?br\s*\/?>/gi, ' ; '));

        if (name && value && !(name in infobox)) infobox[name] = value;
    }

    return { params: infobox, ...(image && { image }) };
};

interface Section {
    heading: string;
    lines: string[];
}

/** Level-2 sections only: `===Filling===` style sub-headings stay inside their parent so their lists are kept. */
const sections = (wikitext: string): Section[] => {
    const found: Section[] = [];

    for (const line of wikitext.split('\n')) {
        const heading = /^==([^=].*?)==\s*$/.exec(line);

        if (heading) found.push({ heading: plainText(heading[1] ?? ''), lines: [] });
        else found.at(-1)?.lines.push(line);
    }

    return found;
};

const listItems = (lines: string[], marker: '*' | '#'): string[] =>
    lines
        .filter((line) => line.startsWith(marker))
        .map((line) => plainText(line.replace(/^[*#:;]+/, '')))
        .filter(Boolean);

// Some pages number their steps by hand ("1. Peel...") instead of using a wiki list.
const typedSteps = (lines: string[]): string[] =>
    lines
        .filter((line) => /^\d+[.)]\s/.test(line))
        .map((line) => plainText(line.replace(/^\d+[.)]\s+/, '')))
        .filter(Boolean);

// A sub-list label such as "For the sauce:" names a group, it is not an ingredient.
const isGroupLabel = (line: string): boolean => line.endsWith(':');

const findProcedure = (all: Section[]): Section | undefined => {
    for (const pattern of PROCEDURE_HEADINGS) {
        const found = all.find((section) => pattern.test(section.heading));

        if (found) return found;
    }

    return undefined;
};

// One guard per way a page can fail to be a usable recipe.
// fallow-ignore-next-line complexity
export const parseWikibooksPage = (wikitext: string): ParsedWikibooksPage | null => {
    if (/^\s*#redirect/i.test(wikitext)) return null;

    const all = sections(wikitext);
    const ingredients = all.find((section) => INGREDIENTS_HEADING.test(section.heading));
    const procedure = findProcedure(all);

    if (!(ingredients && procedure)) return null;

    const ingredientLines = listItems(ingredients.lines, '*').filter((line) => !isGroupLabel(line));
    const numbered = listItems(procedure.lines, '#');
    const instructions = numbered.length > 0 ? numbered : typedSteps(procedure.lines);

    if (ingredientLines.length === 0 || instructions.length === 0) return null;

    const { params, image } = parseInfobox(wikitext);

    return { infobox: params, ingredientLines, instructions, ...(image && { image }) };
};
