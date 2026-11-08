import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { IdGenerator } from '../IdGenerator';
import type { IngredientStructurer, ParsedIngredient } from '../IngredientStructurer/types';
import { RuleIngredientStructurer } from '../RuleIngredientStructurer';
import { RecipeImportService } from './index';
import type { PageFetcher, ParsedRecipe, RecipeParser, RecipeTextExtractor } from './types';

class MockFetcher implements PageFetcher {
    html = '';
    calls: string[] = [];
    error: Error | null = null;

    async fetchPage(url: string): Promise<string> {
        this.calls.push(url);

        if (this.error) throw this.error;

        return this.html;
    }
}

class SequentialIdGenerator implements IdGenerator {
    private n = 0;
    generate(): string {
        this.n += 1;

        return `id-${this.n}`;
    }
}

class ThrowingStructurer implements IngredientStructurer {
    readonly strategy = 'llm' as const;

    async structure(): Promise<ParsedIngredient[]> {
        throw Object.assign(new Error('LLM ingredient structuring failed'), { status: 502 });
    }
}

class FakeRecipeParser implements RecipeParser {
    calls: string[] = [];
    error: Error | null = null;
    result: ParsedRecipe = { title: '', ingredients: [], instructions: [] };

    async parse(source: string): Promise<ParsedRecipe> {
        this.calls.push(source);

        if (this.error) throw this.error;

        return this.result;
    }
}

const jsonLdPage = <T>(ld: T, bodyExtra = ''): string =>
    `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>${bodyExtra}</body></html>`;

describe('RecipeImportService', () => {
    let fetcher: MockFetcher;
    let service: RecipeImportService;

    beforeEach(() => {
        fetcher = new MockFetcher();
        service = new RecipeImportService(fetcher, new SequentialIdGenerator(), new RuleIngredientStructurer());
    });

    describe('URL validation', () => {
        it('rejects a non-URL string', async () => {
            await expect(service.importFromUrl('not a url')).rejects.toMatchObject({ status: 400 });
        });

        it('rejects non-http protocols', async () => {
            await expect(service.importFromUrl('ftp://example.com/x')).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('Tier 1 — JSON-LD', () => {
        it('parses a flat Recipe node', async () => {
            fetcher.html = jsonLdPage({
                '@context': 'https://schema.org',
                '@type': 'Recipe',
                name: 'Test Cake',
                image: 'https://img/cake.jpg',
                recipeIngredient: ['200g flour', '3 eggs', '100g sugar'],
                recipeInstructions: ['Mix.', 'Bake.'],
                prepTime: 'PT20M',
                recipeYield: '8 servings',
            });

            const result = await service.importFromUrl('https://example.com/cake');

            expect(result.title).toBe('Test Cake');
            expect(result.image).toBe('https://img/cake.jpg');
            expect(result.ingredients.map((i) => i.name)).toEqual(['flour', 'eggs', 'sugar']);
            expect(result.ingredients.map((i) => i.quantity)).toEqual([200, 3, 100]);
            expect(result.ingredients.map((i) => i.unit)).toEqual(['g', 'pcs', 'g']);
            expect(result.ingredients[0].id).toBe('id-1');
            expect(result.instructions).toEqual(['Mix.', 'Bake.']);
            expect(result.prepTime).toBe('PT20M');
            expect(result.recipeYield).toBe('8 servings');
            expect(result.link).toBe('https://example.com/cake');
        });

        it('finds a Recipe wrapped inside @graph', async () => {
            fetcher.html = jsonLdPage({
                '@context': 'https://schema.org',
                '@graph': [
                    { '@type': 'WebPage', name: 'Blog' },
                    {
                        '@type': 'Recipe',
                        name: 'Graph Stew',
                        recipeIngredient: ['carrots', 'potatoes'],
                        recipeInstructions: [{ '@type': 'HowToStep', text: 'Chop veg.' }],
                    },
                ],
            });

            const result = await service.importFromUrl('https://example.com/stew');

            expect(result.title).toBe('Graph Stew');
            expect(result.ingredients).toHaveLength(2);
            expect(result.instructions).toEqual(['Chop veg.']);
        });

        it('flattens HowToSection instructions', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Sectioned',
                recipeIngredient: ['a', 'b'],
                recipeInstructions: [
                    {
                        '@type': 'HowToSection',
                        name: 'Prep',
                        itemListElement: [
                            { '@type': 'HowToStep', text: 'Wash.' },
                            { '@type': 'HowToStep', text: 'Peel.' },
                        ],
                    },
                    { '@type': 'HowToStep', text: 'Cook.' },
                ],
            });

            const result = await service.importFromUrl('https://example.com/x');

            expect(result.instructions).toEqual(['Wash.', 'Peel.', 'Cook.']);
        });

        it('handles @type as an array and image as an ImageObject array', async () => {
            fetcher.html = jsonLdPage({
                '@type': ['Recipe', 'NewsArticle'],
                name: 'Multi',
                image: [{ '@type': 'ImageObject', url: 'https://img/first.jpg' }],
                recipeIngredient: ['x', 'y'],
                recipeInstructions: 'Line one\nLine two',
            });

            const result = await service.importFromUrl('https://example.com/x');

            expect(result.image).toBe('https://img/first.jpg');
            expect(result.instructions).toEqual(['Line one', 'Line two']);
        });

        it('recovers a Recipe node whose JSON-LD has raw newlines inside string values', async () => {
            // Some sites (e.g. Shopify recipe apps) emit unescaped control characters
            // inside JSON-LD string literals, which JSON.parse rejects outright.
            fetcher.html = `<!doctype html><html><head><script type="application/ld+json">
                {
                    "@type": "Recipe",
                    "name": "Lasagna",
                    "recipeIngredient": ["2 sticks celery", "1 large carrot"],
                    "recipeInstructions": [
                        { "@type": "HowToStep", "text": "Finely dice the celery, carrot and onion, then finely grate the\n     garlic." }
                    ]
                }
            </script></head><body></body></html>`;

            const result = await service.importFromUrl('https://example.com/lasagna');

            expect(result.title).toBe('Lasagna');
            expect(result.ingredients.map((i) => i.name)).toEqual(['celery', 'carrot']);
            expect(result.instructions).toEqual([
                'Finely dice the celery, carrot and onion, then finely grate the garlic.',
            ]);
        });
    });

    describe('ingredient quantity/unit parsing', () => {
        it('splits quantity and unit out of the name, leaving name free of measurements', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Parsing',
                recipeIngredient: ['1/2 cup salt', '2 cloves garlic', '3 eggs', 'salt to taste'],
                recipeInstructions: ['Do it.'],
            });

            const result = await service.importFromUrl('https://example.com/parsing');

            expect(result.ingredients).toEqual([
                { id: 'id-1', name: 'salt', quantity: 0.5, unit: 'cup' },
                { id: 'id-2', name: 'garlic', quantity: 2, unit: 'cloves' },
                { id: 'id-3', name: 'eggs', quantity: 3, unit: 'pcs' },
                { id: 'id-4', name: 'salt' },
            ]);
        });

        it('defaults unit to "pcs" when a quantity is found but no unit of measure', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'No unit',
                recipeIngredient: ['3 eggs', '1 onion'],
                recipeInstructions: ['Do it.'],
            });

            const result = await service.importFromUrl('https://example.com/no-unit');

            expect(result.ingredients).toEqual([
                { id: 'id-1', name: 'eggs', quantity: 3, unit: 'pcs' },
                { id: 'id-2', name: 'onion', quantity: 1, unit: 'pcs' },
            ]);
        });

        it('falls back to the raw line as the name when it has no quantity or unit', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'No measurements',
                recipeIngredient: ['flour', 'a pinch of nutmeg'],
                recipeInstructions: ['Do it.'],
            });

            const result = await service.importFromUrl('https://example.com/no-measurements');

            expect(result.ingredients.map((i) => i.name)).toEqual(['flour', 'a pinch of nutmeg']);
            expect(result.ingredients.every((i) => i.quantity === undefined && i.unit === undefined)).toBe(true);
        });
    });

    describe('Tier 2 — HTML heuristics', () => {
        it('recovers ingredients/instructions from class-based markup (joshuaweissman shape)', async () => {
            fetcher.html = jsonLdPage(
                {
                    '@type': 'Recipe',
                    name: 'Kimchi',
                    image: 'https://img/kimchi.jpg',
                    prepTime: 'PT30M',
                },
                `<article class="ingredients-list"><ul>
                    <li>1 napa cabbage</li>
                    <li>1/2 cup salt</li>
                    <li>3 tbsp gochugaru</li>
                 </ul></article>
                 <div class="directions-list"><ol>
                    <li>Salt the cabbage.</li>
                    <li>Rinse and drain.</li>
                    <li>Mix with paste.</li>
                 </ol></div>`
            );

            const result = await service.importFromUrl('https://example.com/kimchi');

            expect(result.title).toBe('Kimchi');
            expect(result.image).toBe('https://img/kimchi.jpg');
            expect(result.ingredients.map((i) => i.name)).toEqual(['napa cabbage', 'salt', 'gochugaru']);
            expect(result.ingredients.map((i) => i.quantity)).toEqual([1, 0.5, 3]);
            expect(result.ingredients.map((i) => i.unit)).toEqual(['pcs', 'cup', 'tbsp']);
            expect(result.instructions).toEqual(['Salt the cabbage.', 'Rinse and drain.', 'Mix with paste.']);
        });

        it('parses microdata itemprop when no JSON-LD', async () => {
            fetcher.html = `<html><body>
                <span itemprop="recipeIngredient">2 cups rice</span>
                <span itemprop="recipeIngredient">4 cups water</span>
                <div itemprop="recipeInstructions">Boil rice in water.</div>
                <meta property="og:title" content="Plain Rice" />
            </body></html>`;

            const result = await service.importFromUrl('https://example.com/rice');

            expect(result.title).toBe('Plain Rice');
            expect(result.ingredients.map((i) => i.name)).toEqual(['rice', 'water']);
            expect(result.ingredients.map((i) => i.quantity)).toEqual([2, 4]);
            expect(result.ingredients.map((i) => i.unit)).toEqual(['cups', 'cups']);
            expect(result.instructions).toEqual(['Boil rice in water.']);
        });

        it('falls back to og:title/og:image when nothing else is found', async () => {
            fetcher.html = `<html><head>
                <meta property="og:title" content="Mystery Dish" />
                <meta property="og:image" content="https://img/mystery.jpg" />
            </head><body><p>no recipe markup</p></body></html>`;

            const result = await service.importFromUrl('https://example.com/mystery');

            expect(result.title).toBe('Mystery Dish');
            expect(result.image).toBe('https://img/mystery.jpg');
            expect(result.ingredients).toEqual([]);
            expect(result.instructions).toEqual([]);
        });

        it('keeps richer Tier 1 ingredients rather than overwriting with weaker Tier 2', async () => {
            fetcher.html = jsonLdPage(
                {
                    '@type': 'Recipe',
                    name: 'Rich',
                    recipeIngredient: ['flour', 'eggs', 'butter', 'sugar'],
                    // No instructions -> triggers Tier 2, but ingredients must survive.
                },
                `<div class="ingredient"><li>only one</li></div>
                 <div class="instructions"><ol><li>Step from html.</li></ol></div>`
            );

            const result = await service.importFromUrl('https://example.com/rich');

            expect(result.ingredients.map((i) => i.name)).toEqual(['flour', 'eggs', 'butter', 'sugar']);
            expect(result.instructions).toEqual(['Step from html.']);
        });
    });

    describe('Tier 3 — LLM fallback', () => {
        const llmPage = '<html><body><p>An unparseable recipe blog wall of text.</p></body></html>';

        it('uses the extractor when Tiers 1-2 are insufficient', async () => {
            const extractor: RecipeTextExtractor = {
                async extract() {
                    return {
                        title: 'LLM Dish',
                        ingredients: ['1 onion', '2 cloves garlic'],
                        instructions: ['Fry onion.', 'Add garlic.'],
                    };
                },
            };

            service = new RecipeImportService(
                fetcher,
                new SequentialIdGenerator(),
                new RuleIngredientStructurer(),
                undefined,
                extractor
            );
            fetcher.html = llmPage;

            const result = await service.importFromUrl('https://example.com/blog');

            expect(result.title).toBe('LLM Dish');
            expect(result.ingredients.map((i) => i.name)).toEqual(['onion', 'garlic']);
            expect(result.ingredients.map((i) => i.quantity)).toEqual([1, 2]);
            expect(result.ingredients.map((i) => i.unit)).toEqual(['pcs', 'cloves']);
            expect(result.instructions).toEqual(['Fry onion.', 'Add garlic.']);
        });

        it('returns partial Tier 1-2 result when the LLM throws', async () => {
            const extractor: RecipeTextExtractor = {
                async extract() {
                    throw new Error('llm down');
                },
            };

            service = new RecipeImportService(
                fetcher,
                new SequentialIdGenerator(),
                new RuleIngredientStructurer(),
                undefined,
                extractor
            );
            fetcher.html = `<html><head><meta property="og:title" content="Partial" /></head><body></body></html>`;

            const result = await service.importFromUrl('https://example.com/partial');

            expect(result.title).toBe('Partial');
            expect(result.ingredients).toEqual([]);
        });

        it('does not call the extractor when Tiers 1-2 already succeed', async () => {
            let called = false;

            const extractor: RecipeTextExtractor = {
                async extract() {
                    called = true;

                    return { title: 'x', ingredients: [], instructions: [] };
                },
            };

            service = new RecipeImportService(
                fetcher,
                new SequentialIdGenerator(),
                new RuleIngredientStructurer(),
                undefined,
                extractor
            );
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Complete',
                recipeIngredient: ['rice', 'water'],
                recipeInstructions: ['Do it.'],
            });

            await service.importFromUrl('https://example.com/complete');

            expect(called).toBe(false);
        });
    });

    describe('ingredient structuring', () => {
        it('propagates a structurer failure instead of swallowing it', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Boom',
                recipeIngredient: ['1 onion', '2 carrots'],
                recipeInstructions: ['Do it.'],
            });
            const failing = new RecipeImportService(fetcher, new SequentialIdGenerator(), new ThrowingStructurer());

            await expect(failing.importFromUrl('https://example.com/boom')).rejects.toMatchObject({ status: 502 });
        });
    });

    describe('LLM-first parsing', () => {
        let parser: FakeRecipeParser;

        const llmService = () =>
            new RecipeImportService(
                fetcher,
                new SequentialIdGenerator(),
                new RuleIngredientStructurer(),
                undefined,
                undefined,
                parser
            );

        beforeEach(() => {
            parser = new FakeRecipeParser();
        });

        it('sends the JSON-LD recipe node to the parser when the page has one', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Carbonara',
                recipeIngredient: ['350 g spaghetti (- 12 oz)'],
                recipeInstructions: ['Boil.'],
            });
            parser.result = {
                title: 'Carbonara',
                ingredients: [{ name: 'spaghetti', quantity: 350, unit: 'g' }],
                instructions: ['Boil.'],
            };

            const result = await llmService().importFromUrl('https://example.com/c');

            expect(parser.calls).toHaveLength(1);
            expect(parser.calls[0]).toContain('recipeIngredient');
            expect(result.ingredients).toEqual([{ id: 'id-1', name: 'spaghetti', quantity: 350, unit: 'g' }]);
            expect(result.instructions).toEqual(['Boil.']);
            expect(result.title).toBe('Carbonara');
        });

        it('does not clean the names the LLM returned', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'X',
                recipeIngredient: ['a'],
                recipeInstructions: ['b'],
            });
            parser.result = {
                title: 'X',
                ingredients: [{ name: 'guanciale (Italian cured pork cheek)' }],
                instructions: ['b'],
            };

            const result = await llmService().importFromUrl('https://example.com/c');

            expect(result.ingredients[0].name).toBe('guanciale (Italian cured pork cheek)');
        });

        it('falls back to page text when the page has no JSON-LD recipe node', async () => {
            fetcher.html = '<html><body><p>Some recipe prose here.</p></body></html>';
            parser.result = { title: 'Prose', ingredients: [{ name: 'salt' }], instructions: ['Do.'] };

            await llmService().importFromUrl('https://example.com/c');

            expect(parser.calls[0]).toContain('Some recipe prose here.');
        });

        it('still sends the JSON-LD recipe node when it has raw newlines inside string values', async () => {
            fetcher.html = `<!doctype html><html><head><script type="application/ld+json">
                {
                    "@type": "Recipe",
                    "name": "Lasagna",
                    "recipeIngredient": ["2 sticks celery"],
                    "recipeInstructions": [
                        { "@type": "HowToStep", "text": "Finely dice the celery, then finely grate the\n     garlic." }
                    ]
                }
            </script></head><body></body></html>`;
            parser.result = { title: 'Lasagna', ingredients: [{ name: 'celery' }], instructions: ['Dice.'] };

            await llmService().importFromUrl('https://example.com/lasagna');

            // Proves the JSON-LD node was recovered and serialized, not the htmlToText
            // fallback (which strips <script> tags and would never contain this key).
            expect(parser.calls[0]).toContain('recipeIngredient');
            expect(parser.calls[0]).toContain('2 sticks celery');
        });

        it('keeps image and timing metadata scraped from the page', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Carbonara',
                image: 'https://img/c.jpg',
                prepTime: 'PT10M',
                cookTime: 'PT15M',
                recipeYield: '4 servings',
                recipeIngredient: ['350 g spaghetti'],
                recipeInstructions: ['Boil.'],
            });
            parser.result = { title: 'Carbonara', ingredients: [{ name: 'spaghetti' }], instructions: ['Boil.'] };

            const result = await llmService().importFromUrl('https://example.com/c');

            expect(result.image).toBe('https://img/c.jpg');
            expect(result.prepTime).toBe('PT10M');
            expect(result.cookTime).toBe('PT15M');
            expect(result.recipeYield).toBe('4 servings');
        });

        it('propagates a parser failure instead of falling back to the tiers', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Carbonara',
                recipeIngredient: ['1 onion', '2 carrots'],
                recipeInstructions: ['Boil.'],
            });
            parser.error = Object.assign(new Error('llm down'), { status: 502 });

            await expect(llmService().importFromUrl('https://example.com/c')).rejects.toMatchObject({ status: 502 });
        });

        it('never calls the parser when no llmParser is injected', async () => {
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Carbonara',
                recipeIngredient: ['350 g spaghetti (- 12 oz)'],
                recipeInstructions: ['Boil.'],
            });

            const result = await service.importFromUrl('https://example.com/c');

            expect(parser.calls).toHaveLength(0);
            expect(result.ingredients[0].name).toBe('spaghetti');
        });

        it('sends a large JSON-LD recipe node whole rather than truncating it into broken JSON', async () => {
            const longStep = 'Stir the pot thoroughly and keep going. '.repeat(200);
            fetcher.html = jsonLdPage({
                '@type': 'Recipe',
                name: 'Long',
                recipeIngredient: ['1 onion'],
                recipeInstructions: [longStep, 'Serve.'],
            });
            parser.result = { title: 'Long', ingredients: [{ name: 'onion' }], instructions: ['Serve.'] };

            await llmService().importFromUrl('https://example.com/long');

            expect(parser.calls[0].length).toBeGreaterThan(6000);
            expect(() => JSON.parse(parser.calls[0])).not.toThrow();
            expect(JSON.parse(parser.calls[0]).name).toBe('Long');
        });

        it('falls back to page text when the JSON-LD recipe node is pathologically large', async () => {
            const hugeStep = 'x'.repeat(30000);
            fetcher.html = jsonLdPage(
                {
                    '@type': 'Recipe',
                    name: 'Huge',
                    recipeIngredient: ['1 onion'],
                    recipeInstructions: [hugeStep],
                },
                '<p>Readable prose fallback.</p>'
            );
            parser.result = { title: 'Huge', ingredients: [{ name: 'onion' }], instructions: ['Do.'] };

            await llmService().importFromUrl('https://example.com/huge');

            expect(parser.calls[0]).toContain('Readable prose fallback.');
            expect(parser.calls[0].length).toBeLessThanOrEqual(6000);
        });
    });

    describe('importImage', () => {
        const mockFetcher = { fetchPage: vi.fn() };
        const mockIdGenerator = { generate: vi.fn(() => 'id-1') };

        const mockStructurer = {
            strategy: 'rule',
            structure: vi.fn(async (lines: string[]) => lines.map((name) => ({ name }))),
        };

        const mockImageFetcher = { fetchImage: vi.fn() };

        it('rejects an invalid URL before calling the image fetcher', async () => {
            const service = new RecipeImportService(
                mockFetcher,
                mockIdGenerator,
                mockStructurer,
                undefined,
                undefined,
                undefined,
                mockImageFetcher
            );

            await expect(service.importImage('not-a-url')).rejects.toMatchObject({ status: 400 });
            expect(mockImageFetcher.fetchImage).not.toHaveBeenCalled();
        });

        it('delegates to the injected image fetcher for a valid URL', async () => {
            mockImageFetcher.fetchImage.mockResolvedValue({ buffer: Buffer.from([1, 2]), contentType: 'image/png' });

            const service = new RecipeImportService(
                mockFetcher,
                mockIdGenerator,
                mockStructurer,
                undefined,
                undefined,
                undefined,
                mockImageFetcher
            );

            const result = await service.importImage('https://example.com/cover.png');

            expect(mockImageFetcher.fetchImage).toHaveBeenCalledWith('https://example.com/cover.png');
            expect(result.contentType).toBe('image/png');
        });

        it('throws a 501 when no image fetcher is configured', async () => {
            const service = new RecipeImportService(mockFetcher, mockIdGenerator, mockStructurer);

            await expect(service.importImage('https://example.com/cover.png')).rejects.toMatchObject({ status: 501 });
        });
    });
});
