import { describe, expect, it } from 'bun:test';

import { RuleIngredientStructurer } from '../RuleIngredientStructurer';
import { parseWikibooksPage } from './wikitext';

// Trimmed from the live page Cookbook:'Out of Salad Dressing' Salad Dressing (revision 4654716).
const SALAD_DRESSING = `{{recipe|O}}{{Recipesummary
| Category = Salad dressing recipes
| Servings = 12
| Time = 8 h, 10 minutes
| Rating = 1
}}

{{Nutrition Summary|
|ServingSize=1/12 of recipe
|Cals=148
}}

From the original recipe contributor:<blockquote>''"This is a recipe I created."''</blockquote>

==Ingredients==
* 1 ½ [[Cookbook:Lemon|lemons]], juiced 
* 1 [[Cookbook:Cup|cup]] freshly [[Cookbook:Grating|grated]] [[Cookbook:Parmesan Cheese|Parmesan cheese]]
* ¾ cup [[Cookbook:Mayonnaise|mayonnaise]]

==Procedure==
# Mix together lemon juice, Parmesan cheese, garlic salt, and mayonnaise until smooth.
# Cover and refrigerate 8 hours, or overnight.

==Notes, tips, and variations==
* Instead of garlic salt, crush a clove of [[Cookbook:Garlic|garlic]].

[[Category:Recipes for salad dressing]]`;

// The inline infobox form, and the "</br>" typo, as they appear on live pages.
const INLINE_INFOBOX = `__NOTOC__
{{recipesummary|category=Cake recipes|servings=8–10|time=Prep: 20 minutes</br>Baking: 60 minutes|difficulty=2|image=[[Image:1-2-3-4 cake.JPG|300px]]
}}

==Ingredients==
* 1 [[Cookbook:Cup|cup]] (240 [[Cookbook:Gram|g]] / 8.5 [[Cookbook:Ounce|oz]]) [[Cookbook:Butter|butter]]
* 3 cups (400 g / 14 oz) [[Cookbook:Flour|flour]]<ref>Sifted.</ref>

==Procedure==
# Cream the butter.
## Then add the sugar.
# Bake.`;

const SUBSECTIONS = `{{recipesummary|category=Pastry recipes|difficulty=3}}
==Ingredients==
===Dough===
* 200 g flour
*'''Filling:'''
* 3 apples
==Procedure==
===Dough===
# Knead the dough.
===Filling===
# Slice the apples.`;

describe('parseWikibooksPage', () => {
    it('reads a page into infobox, ingredient lines and steps', () => {
        const page = parseWikibooksPage(SALAD_DRESSING);
        expect(page).toEqual({
            infobox: { category: 'Salad dressing recipes', servings: '12', time: '8 h, 10 minutes', rating: '1' },
            ingredientLines: ['1 ½ lemons, juiced', '1 cup freshly grated Parmesan cheese', '¾ cup mayonnaise'],
            instructions: [
                'Mix together lemon juice, Parmesan cheese, garlic salt, and mayonnaise until smooth.',
                'Cover and refrigerate 8 hours, or overnight.',
            ],
        });
    });

    it('does not mistake the notes section for ingredients or steps', () => {
        const page = parseWikibooksPage(SALAD_DRESSING);
        expect(page?.ingredientLines.join()).not.toContain('garlic salt, crush');
    });

    it('reads the single-line infobox and keeps <br> and the </br> typo as a separator between times', () => {
        const page = parseWikibooksPage(INLINE_INFOBOX);
        expect(page?.infobox.time).toBe('Prep: 20 minutes ; Baking: 60 minutes');
        expect(page?.infobox.category).toBe('Cake recipes');
        // The image parameter holds wikitext the recipe never needs but must not break parameter splitting.
        expect(page?.infobox.difficulty).toBe('2');
    });

    it('drops refs and unit links from ingredient lines, keeping the stated metric conversions', () => {
        const page = parseWikibooksPage(INLINE_INFOBOX);
        expect(page?.ingredientLines).toEqual(['1 cup (240 g / 8.5 oz) butter', '3 cups (400 g / 14 oz) flour']);
    });

    it('flattens nested steps and keeps lists under ===sub-headings===, skipping group labels', () => {
        const page = parseWikibooksPage(SUBSECTIONS);
        expect(page?.ingredientLines).toEqual(['200 g flour', '3 apples']);
        expect(page?.instructions).toEqual(['Knead the dough.', 'Slice the apples.']);
    });

    it('accepts hand-numbered steps and a qualified procedure heading', () => {
        const page = parseWikibooksPage(
            '==Ingredients:==\n* 2 kg cassava\n==Procedure (brief)==\n1. Peel the cassava.\n2. Boil it.'
        );

        expect(page?.instructions).toEqual(['Peel the cassava.', 'Boil it.']);
        expect(page?.ingredientLines).toEqual(['2 kg cassava']);
    });

    it('rejects redirects, index pages and pages whose ingredients are a table', () => {
        expect(parseWikibooksPage('#REDIRECT [[Cookbook:Whole-Wheat Chocolate Cake with Nuts]]')).toBeNull();
        expect(
            parseWikibooksPage('There are several recipes for Baklava.\n*[[Cookbook:Baklava I|Baklava I]]')
        ).toBeNull();
        expect(
            parseWikibooksPage(
                '==Ingredients==\n{| class="wikitable"\n! Ingredient\n|-\n| Abacha\n|}\n==Procedure==\n# Soak the abacha.'
            )
        ).toBeNull();
    });
});

/** Runs ingredient wikitext lines through the page parser, as a real page would. */
const ingredientLines = (...lines: string[]): string[] =>
    parseWikibooksPage(`==Ingredients==\n${lines.map((line) => `* ${line}`).join('\n')}\n==Procedure==\n# Mix.`)
        ?.ingredientLines ?? [];

describe('wikitext cleaning', () => {
    it('keeps the measurement of a convert template and drops other templates', () => {
        expect(ingredientLines('{{convert|1|cup|ml}} milk{{citation needed}}')).toEqual(['1 cup milk']);
    });

    it('decodes entities and strips links, emphasis and html', () => {
        expect(ingredientLines("[[Cookbook:Sugar|sugar]] &amp; '''salt''' &frac12; tsp<br/>fine")).toEqual([
            'sugar & salt ½ tsp fine',
        ]);
    });
});

describe('ingredient lines from real pages become structured ingredients', () => {
    const structurer = new RuleIngredientStructurer();

    it('handles fractions, ranges, parenthesised metric and (optional)', async () => {
        const structured = await structurer.structure(
            ingredientLines(
                '1 ½ [[Cookbook:Lemon|lemons]], juiced ',
                '⅔–¾ cup (120–150 g) brown sugar',
                '2 tablespoons (30 [[Cookbook:Gram|g]]) butter',
                'Liquid smoke (optional)'
            )
        );

        expect(structured).toEqual([
            { name: 'lemons, juiced', quantity: 1.5, unit: 'pcs' },
            { name: 'brown sugar', quantity: 0.667, unit: 'cup' },
            { name: 'butter', quantity: 2, unit: 'tablespoons' },
            { name: 'Liquid smoke' },
        ]);
    });
});

describe('cover picture', () => {
    const page = (image: string) => `{{recipesummary|category=Soup recipes|image=${image}|difficulty=2}}
==Ingredients==
* 2 cups water
==Procedure==
# Boil it.`;

    it.each([
        ['a File link with a size', '[[File:Nice Cup of Tea.jpg|300px]]', 'Nice Cup of Tea.jpg'],
        [
            'an Image link',
            '[[Image:1-2-3-4 cake slice with chocolate sour cream icing.JPG|thumb|A cake]]',
            '1-2-3-4 cake slice with chocolate sour cream icing.JPG',
        ],
        ['an unclosed link, as found on live pages', '[[File:Abak soup 02.jpg', 'Abak soup 02.jpg'],
        ['a bare file name', 'Baked Ziti.jpg', 'Baked Ziti.jpg'],
        ['a File: prefix without brackets', 'File:Affogato.JPG', 'Affogato.JPG'],
        ['underscores', '[[File:Afghan_bread.png|200px]]', 'Afghan bread.png'],
        ['non-ASCII names', '[[File:Àádùn2.jpg]]', 'Àádùn2.jpg'],
        ['a trailing comment', '[[File:Agedashi.jpg]]<!-- cropped -->', 'Agedashi.jpg'],
    ])('reads %s', (_label, raw, expected) => {
        expect(parseWikibooksPage(page(raw))?.image).toBe(expected);
    });

    it.each([
        ['an icon in a format browsers cannot all show', '[[File:PD-icon.svg]]'],
        ['an animated format', '[[File:Whisk.gif]]'],
        ['an empty value', ''],
        ['a template placeholder', '{{{image|}}}'],
    ])('ignores %s', (_label, raw) => {
        expect(parseWikibooksPage(page(raw))?.image).toBeUndefined();
    });

    it('does not take a picture from the page body, where flags and icons live', () => {
        const text = `{{recipesummary|category=Soup recipes}}
[[File:Flag of Nigeria.jpg|thumb]]
==Ingredients==
* 2 cups water
==Procedure==
# Boil it.`;

        expect(parseWikibooksPage(text)?.image).toBeUndefined();
    });
});
