import type { Logger } from '@imapps/api-utils';
import type { RecipeImportResult } from '@tandra/types';
import * as cheerio from 'cheerio';

import type { IdGenerator } from '../IdGenerator';
import type { IngredientStructurer } from '../IngredientStructurer/types';
import type { ImageFetcher, PageFetcher, ParsedRecipe, RecipeDraft, RecipeParser, RecipeTextExtractor } from './types';

const MIN_INGREDIENTS = 2;
const MAX_ITEMS = 100;
const LLM_TEXT_LIMIT = 6000;

// A serialized JSON-LD recipe node is sent whole: truncating it would hand the model broken JSON.
// Past this cap the node is pathological, so fall back to page text instead.
const LLM_JSON_LIMIT = 24000;

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

const cleanList = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const raw of values) {
        if (typeof raw !== 'string') continue;
        const value = collapse(raw);

        if (value.length < 2 || value.length > 500) continue;

        if (seen.has(value)) continue;
        seen.add(value);
        out.push(value);

        if (out.length >= MAX_ITEMS) break;
    }

    return out;
};

export class RecipeImportService {
    constructor(
        private readonly fetcher: PageFetcher,
        private readonly idGenerator: IdGenerator,
        private readonly structurer: IngredientStructurer,
        private readonly logger?: Logger,
        private readonly llmExtractor?: RecipeTextExtractor,
        private readonly llmParser?: RecipeParser,
        private readonly imageFetcher?: ImageFetcher
    ) {}

    // Invoked via the DI container (getRecipeImportService().importFromUrl); fallow can't trace that indirection.
    // fallow-ignore-next-line unused-class-member
    async importFromUrl(url: string): Promise<RecipeImportResult> {
        const parsed = this.parseUrl(url);
        const html = await this.fetcher.fetchPage(parsed);

        // LLM-first: injection of a parser IS the flag. The three tiers never run.
        if (this.llmParser) {
            return this.importViaLlm(html, parsed);
        }

        const draft: RecipeDraft = {
            title: '',
            ingredients: [],
            instructions: [],
            link: parsed,
        };

        // Tier 1 — structured JSON-LD (free, most reliable when present).
        this.mergeDraft(draft, this.parseJsonLd(html));

        // Tier 2 — HTML heuristics, only when Tier 1 came up short.
        if (this.isInsufficient(draft)) {
            this.mergeDraft(draft, this.parseHtml(html));
        }

        // Tier 3 — LLM fallback, only when still short and explicitly enabled/wired.
        if (this.isInsufficient(draft) && this.llmExtractor) {
            await this.tryLlm(draft, html);
        }

        const started = Date.now();
        const structured = await this.structurer.structure(draft.ingredients);
        this.logger?.info('Recipe import structured ingredients', {
            strategy: this.structurer.strategy,
            lineCount: draft.ingredients.length,
            durationMs: Date.now() - started,
        });

        return {
            title: draft.title,
            ingredients: structured.map((parsed) => ({ ...parsed, id: this.idGenerator.generate() })),
            instructions: draft.instructions,
            link: draft.link,
            ...(draft.image !== undefined && { image: draft.image }),
            ...(draft.prepTime !== undefined && { prepTime: draft.prepTime }),
            ...(draft.cookTime !== undefined && { cookTime: draft.cookTime }),
            ...(draft.recipeYield !== undefined && { recipeYield: draft.recipeYield }),
        };
    }

    /** Proxy-fetch a scraped recipe's cover image so the browser can attach it without hitting third-party CORS. */
    // Invoked via the DI container (getRecipeImportService().importImage); fallow can't trace that indirection.
    // fallow-ignore-next-line unused-class-member
    async importImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
        const parsed = this.parseUrl(url);

        if (!this.imageFetcher) {
            throw Object.assign(new Error('Image proxy not configured'), { status: 501 });
        }

        return this.imageFetcher.fetchImage(parsed);
    }

    private parseUrl(url: string): string {
        let parsed: URL;

        try {
            parsed = new URL(url);
        } catch {
            throw Object.assign(new Error('Invalid URL'), { status: 400 });
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw Object.assign(new Error('URL must be http or https'), { status: 400 });
        }

        return parsed.toString();
    }

    private async importViaLlm(html: string, link: string): Promise<RecipeImportResult> {
        const source = this.llmSource(html);
        const started = Date.now();
        const parsed: ParsedRecipe = await (this.llmParser as RecipeParser).parse(source);
        this.logger?.info('Recipe import parsed with LLM', {
            strategy: 'llm-first',
            ingredientCount: parsed.ingredients.length,
            durationMs: Date.now() - started,
        });

        return {
            title: parsed.title,
            ingredients: parsed.ingredients.map((ingredient) => ({
                ...ingredient,
                id: this.idGenerator.generate(),
            })),
            instructions: parsed.instructions,
            link,
            ...this.metadataFrom(html),
        };
    }

    // Prefer the page's own JSON-LD recipe node; fall back to page text so the flag never silently no-ops.
    private llmSource(html: string): string {
        const $ = cheerio.load(html);

        for (const block of $('script[type="application/ld+json"]').toArray()) {
            const raw = $(block).text();

            if (!raw.trim()) continue;

            const parsed = this.parseJsonLoosely(raw);

            if (parsed === undefined) continue;

            const node = this.findRecipeNode(parsed);

            if (node) {
                const serialized = JSON.stringify(node);

                if (serialized.length <= LLM_JSON_LIMIT) return serialized;
                break;
            }
        }

        return this.htmlToText(html).slice(0, LLM_TEXT_LIMIT);
    }

    // Image and timings stay scraped: they are reliable, free, and not worth an LLM round trip.
    private metadataFrom(html: string): Partial<RecipeDraft> {
        const structured = this.parseJsonLd(html);
        const scraped = this.parseHtml(html);
        const image = structured.image ?? scraped.image;
        const prepTime = structured.prepTime ?? scraped.prepTime;
        const cookTime = structured.cookTime ?? scraped.cookTime;
        const recipeYield = structured.recipeYield ?? scraped.recipeYield;

        return {
            ...(image !== undefined && { image }),
            ...(prepTime !== undefined && { prepTime }),
            ...(cookTime !== undefined && { cookTime }),
            ...(recipeYield !== undefined && { recipeYield }),
        };
    }

    private isInsufficient(draft: RecipeDraft): boolean {
        return draft.ingredients.length < MIN_INGREDIENTS || draft.instructions.length === 0;
    }

    // Fill only what's still missing/weaker, so cheaper tiers win when they already succeeded.
    private mergeDraft(draft: RecipeDraft, next: Partial<RecipeDraft>): void {
        if (!draft.title && next.title) draft.title = next.title;

        if (next.ingredients && next.ingredients.length > draft.ingredients.length) {
            draft.ingredients = next.ingredients;
        }

        if (next.instructions && next.instructions.length > draft.instructions.length) {
            draft.instructions = next.instructions;
        }

        if (!draft.image && next.image) draft.image = next.image;

        if (!draft.prepTime && next.prepTime) draft.prepTime = next.prepTime;

        if (!draft.cookTime && next.cookTime) draft.cookTime = next.cookTime;

        if (!draft.recipeYield && next.recipeYield) draft.recipeYield = next.recipeYield;
    }

    private parseJsonLd(html: string): Partial<RecipeDraft> {
        const $ = cheerio.load(html);
        const blocks = $('script[type="application/ld+json"]').toArray();

        for (const block of blocks) {
            const raw = $(block).text();

            if (!raw.trim()) continue;

            const parsed = this.parseJsonLoosely(raw);

            if (parsed === undefined) continue;

            const recipe = this.findRecipeNode(parsed);

            if (recipe) {
                return this.draftFromRecipeNode(recipe);
            }
        }

        return {};
    }

    // Some sites (e.g. Shopify recipe apps) emit JSON-LD with raw, unescaped control
    // characters — usually literal newlines — inside string values, which is invalid
    // JSON. A strict JSON.parse throws on the whole block, silently discarding an
    // otherwise-complete recipe and falling through to much cruder extraction tiers.
    // Retry with control characters escaped only where they appear inside a string.
    private parseJsonLoosely(raw: string): unknown {
        try {
            return JSON.parse(raw);
        } catch {
            try {
                return JSON.parse(this.sanitizeJsonControlChars(raw));
            } catch {
                return undefined;
            }
        }
    }

    private sanitizeJsonControlChars(raw: string): string {
        let out = '';
        let inString = false;
        let escaped = false;

        for (const ch of raw) {
            if (!inString) {
                if (ch === '"') inString = true;
                out += ch;
                continue;
            }

            const code = ch.charCodeAt(0);

            if (escaped) {
                out += ch;
                escaped = false;
            } else if (ch === '\\') {
                out += ch;
                escaped = true;
            } else if (ch === '"') {
                inString = false;
                out += ch;
            } else if (code < 0x20) {
                if (ch === '\n') out += '\\n';
                else if (ch === '\r') out += '\\r';
                else if (ch === '\t') out += '\\t';
                else out += `\\u${code.toString(16).padStart(4, '0')}`;
            } else {
                out += ch;
            }
        }

        return out;
    }

    // JSON-LD may be a single object, an array of nodes, or wrap nodes in a top-level @graph.
    private findRecipeNode(node: unknown): Record<string, unknown> | null {
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = this.findRecipeNode(item);

                if (found) return found;
            }

            return null;
        }

        if (!node || typeof node !== 'object') return null;

        const obj = node as Record<string, unknown>;

        if (Array.isArray(obj['@graph'])) {
            const found = this.findRecipeNode(obj['@graph']);

            if (found) return found;
        }

        const type = obj['@type'];
        const types = Array.isArray(type) ? type : [type];

        if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
            return obj;
        }

        return null;
    }

    private draftFromRecipeNode(recipe: Record<string, unknown>): Partial<RecipeDraft> {
        const draft: Partial<RecipeDraft> = {};

        const name = recipe.name ?? recipe.headline;

        if (typeof name === 'string' && collapse(name)) draft.title = collapse(name);

        const ingredients = cleanList(this.toStringArray(recipe.recipeIngredient));

        if (ingredients.length) draft.ingredients = ingredients;

        const instructions = cleanList(this.flattenInstructions(recipe.recipeInstructions));

        if (instructions.length) draft.instructions = instructions;

        const image = this.extractImage(recipe.image);

        if (image) draft.image = image;

        for (const [field, key] of [
            ['prepTime', 'prepTime'],
            ['cookTime', 'cookTime'],
            ['recipeYield', 'recipeYield'],
        ] as const) {
            const value = recipe[key];

            if (typeof value === 'string' && value.trim()) draft[field] = value.trim();
            else if (Array.isArray(value) && typeof value[0] === 'string') draft[field] = value[0].trim();
        }

        return draft;
    }

    private toStringArray(value: unknown): string[] {
        if (typeof value === 'string') return [value];

        if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');

        return [];
    }

    // recipeInstructions may be a string, string[], HowToStep[], or HowToSection[] (with nested steps).
    private flattenInstructions(value: unknown): string[] {
        if (!value) return [];

        if (typeof value === 'string') {
            return value.split('\n');
        }

        if (Array.isArray(value)) {
            return value.flatMap((item) => this.flattenInstructions(item));
        }

        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            const type = typeof obj['@type'] === 'string' ? (obj['@type'] as string).toLowerCase() : '';

            if (type === 'howtosection' || Array.isArray(obj.itemListElement)) {
                return this.flattenInstructions(obj.itemListElement);
            }

            if (typeof obj.text === 'string') return [obj.text];

            if (typeof obj.name === 'string') return [obj.name];
        }

        return [];
    }

    private extractImage(value: unknown): string | undefined {
        if (!value) return undefined;

        if (typeof value === 'string') return value;

        if (Array.isArray(value)) {
            for (const item of value) {
                const found = this.extractImage(item);

                if (found) return found;
            }

            return undefined;
        }

        if (typeof value === 'object') {
            const url = (value as Record<string, unknown>).url;

            if (typeof url === 'string') return url;
        }

        return undefined;
    }

    private parseHtml(html: string): Partial<RecipeDraft> {
        const $ = cheerio.load(html);
        const draft: Partial<RecipeDraft> = {};

        // Ingredients: microdata first, then class/id substring heuristic.
        let ingredients = cleanList(
            $('[itemprop="recipeIngredient"], [itemprop="ingredients"]')
                .toArray()
                .map((el) => $(el).text())
        );

        if (ingredients.length < MIN_INGREDIENTS) {
            ingredients = cleanList(
                $('[class*="ingredient" i] li, [id*="ingredient" i] li')
                    .toArray()
                    .map((el) => $(el).text())
            );
        }

        if (ingredients.length) draft.ingredients = ingredients;

        // Instructions: microdata first, then ordered-list items inside instruction/direction/step containers.
        let instructions = cleanList(
            $('[itemprop="recipeInstructions"]')
                .toArray()
                .map((el) => $(el).text())
        );

        if (instructions.length < 1) {
            instructions = cleanList(
                $(
                    '[class*="instruction" i] ol li, [id*="instruction" i] ol li, [class*="direction" i] ol li, [id*="direction" i] ol li, [class*="step" i] ol li, [id*="step" i] ol li'
                )
                    .toArray()
                    .map((el) => $(el).text())
            );
        }

        if (instructions.length) draft.instructions = instructions;

        const title = $('meta[property="og:title"]').attr('content') ?? $('title').first().text();

        if (title && collapse(title)) draft.title = collapse(title);

        const image = $('meta[property="og:image"]').attr('content');

        if (image) draft.image = image;

        return draft;
    }

    private async tryLlm(draft: RecipeDraft, html: string): Promise<void> {
        try {
            const text = this.htmlToText(html).slice(0, LLM_TEXT_LIMIT);
            const extracted = await this.llmExtractor?.extract(text);

            if (!extracted) return;
            this.mergeDraft(draft, {
                title: extracted.title ? collapse(extracted.title) : undefined,
                ingredients: cleanList(extracted.ingredients ?? []),
                instructions: cleanList(extracted.instructions ?? []),
            });
        } catch (error) {
            // Tier 3 is best-effort: never fail the whole import on an LLM error.
            this.logger?.warn('Recipe import LLM fallback failed', { error: (error as Error)?.message });
        }
    }

    private htmlToText(html: string): string {
        const $ = cheerio.load(html);
        $('script, style, nav, header, footer, noscript, svg').remove();

        return collapse($('body').text() || $.root().text());
    }
}
