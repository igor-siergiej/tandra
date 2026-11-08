import { describe, expect, it } from 'bun:test';

import {
    attributionFor,
    cleanCategory,
    mapDifficulty,
    pageUrl,
    parseServings,
    parseTimes,
    recipeIdFor,
    recipeTitle,
} from './mapping';

describe('mapDifficulty', () => {
    it.each([
        ['1', 'easy'],
        ['2', 'medium'],
        ['3', 'medium'],
        ['4', 'hard'],
        ['5', 'hard'],
    ] as const)('maps wiki rating %s to %s', (raw, expected) => {
        expect(mapDifficulty(raw)).toBe(expected);
    });

    it('leaves out-of-range and missing ratings unknown so they are estimated', () => {
        expect(mapDifficulty('0')).toBeUndefined();
        expect(mapDifficulty('9')).toBeUndefined();
        expect(mapDifficulty(undefined)).toBeUndefined();
        expect(mapDifficulty('easy')).toBeUndefined();
    });
});

describe('cleanCategory', () => {
    it('turns infobox categories into tags', () => {
        expect(cleanCategory('Dessert_recipes')).toBe('dessert');
        expect(cleanCategory('Nigerian recipes')).toBe('nigerian');
        expect(cleanCategory('/wiki/Category:Salad_dressing_recipes')).toBe('salad dressing');
        expect(cleanCategory('Recipes for dessert')).toBe('dessert');
        expect(cleanCategory('Recipes using peanut butter')).toBe('peanut butter');
        expect(cleanCategory('Recipes for dessert\u200e')).toBe('dessert');
        expect(cleanCategory(undefined)).toBeUndefined();
    });
});

describe('parseServings', () => {
    it.each([
        ['About 6', 6],
        ['8-10', 8],
        ['4–6', 4],
        ['8 pieces', 8],
        ['12', 12],
    ])('reads %s as %d', (raw, expected) => {
        expect(parseServings(raw)).toBe(expected);
    });

    it('does not guess from prose or absurd numbers', () => {
        expect(parseServings('depends on loaf size')).toBeUndefined();
        expect(parseServings('varies')).toBeUndefined();
        expect(parseServings('0')).toBeUndefined();
        expect(parseServings('500')).toBeUndefined();
    });
});

// Strings are the real `time` values found on Wikibooks Cookbook pages.
describe('parseTimes', () => {
    it('splits prep from cook when both are labelled', () => {
        expect(parseTimes('Prep: 20 minutes ; Baking: 60 minutes')).toEqual({ prepTime: 20, cookTime: 60 });
        expect(parseTimes('Prep: 10 minutes ; Cooking: 5 minutes per skillet of pancakes')).toEqual({
            prepTime: 10,
            cookTime: 5,
        });
        expect(parseTimes('prep: 45 minutes ; baking: ~60 minutes')).toEqual({ prepTime: 45, cookTime: 60 });
    });

    it('sends a single unlabelled total to cookTime and leaves prepTime unset', () => {
        expect(parseTimes('1 hour 30 minutes')).toEqual({ cookTime: 90 });
        expect(parseTimes('8 h, 10 minutes')).toEqual({ cookTime: 490 });
        expect(parseTimes('2 hours')).toEqual({ cookTime: 120 });
    });

    it('does not double count a Total that repeats labelled parts', () => {
        expect(parseTimes('Prep: 5 minutes ; Cooking: 10 minutes ; Total: 15 minutes')).toEqual({
            prepTime: 5,
            cookTime: 10,
        });
    });

    it('takes a Total on its own as the cook time', () => {
        expect(parseTimes('Total: 15 minutes')).toEqual({ cookTime: 15 });
    });

    it('counts a range at its upper end and understands vulgar fractions', () => {
        expect(parseTimes('20–30 minutes')).toEqual({ cookTime: 30 });
        expect(parseTimes('1½ hours')).toEqual({ cookTime: 90 });
    });

    it('leaves unparseable or absurd values for the estimator', () => {
        expect(parseTimes('overnight')).toEqual({});
        expect(parseTimes('varies')).toEqual({});
        expect(parseTimes('20-80 days')).toEqual({});
        expect(parseTimes(undefined)).toEqual({});
    });
});

describe('provenance', () => {
    it('names the recipe without the wiki namespace and links the page', () => {
        expect(recipeTitle("Cookbook:'Out of Salad Dressing' Salad Dressing")).toBe(
            "'Out of Salad Dressing' Salad Dressing"
        );
        expect(pageUrl('Cookbook:Apple Pie (Dutch)')).toBe('https://en.wikibooks.org/wiki/Cookbook:Apple_Pie_(Dutch)');
        expect(pageUrl('Cookbook:Bánh chưng')).toBe('https://en.wikibooks.org/wiki/Cookbook:B%C3%A1nh_ch%C6%B0ng');
    });

    it('states the licence and the page in the attribution', () => {
        const text = attributionFor('Cookbook:Apple Pie');
        expect(text).toContain('"Apple Pie" from Wikibooks Cookbook, CC BY-SA 4.0');
        expect(text).toContain('https://en.wikibooks.org/wiki/Cookbook:Apple_Pie');
    });

    it('keys a recipe by the wiki page id, which survives a rename', () => {
        expect(recipeIdFor(4241)).toBe('wikibooks-4241');
    });
});
