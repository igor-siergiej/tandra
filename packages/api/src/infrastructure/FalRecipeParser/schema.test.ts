import { describe, expect, it } from 'bun:test';

import { parsedRecipeSchema } from './schema';

// The schema is the boundary decoder for a model reply, so the tests feed it raw values of any shape.
const parse: typeof parsedRecipeSchema.parse = (input) => parsedRecipeSchema.parse(input);

describe('parsedRecipeSchema', () => {
    it('keeps clean ingredients with name, quantity and unit', () => {
        const result = parse({
            title: 'Spaghetti Carbonara',
            ingredients: [{ name: 'spaghetti', quantity: 350, unit: 'g' }, { name: 'freshly ground black pepper' }],
            instructions: ['Boil the pasta.', 'Fry the guanciale.'],
        });

        expect(result).toEqual({
            title: 'Spaghetti Carbonara',
            ingredients: [{ name: 'spaghetti', quantity: 350, unit: 'g' }, { name: 'freshly ground black pepper' }],
            instructions: ['Boil the pasta.', 'Fry the guanciale.'],
        });
    });

    it('trims the title, and coerces a non-string title to an empty string', () => {
        expect(parse({ title: '  Soup  ', ingredients: [{ name: 'water' }], instructions: [] }).title).toBe('Soup');
        expect(parse({ title: 42, ingredients: [{ name: 'water' }], instructions: [] }).title).toBe('');
        expect(parse({ ingredients: [{ name: 'water' }], instructions: [] }).title).toBe('');
    });

    it('defaults the unit to pcs when a quantity is given without one', () => {
        const result = parse({ title: 'X', ingredients: [{ name: 'eggs', quantity: 4 }], instructions: ['Do.'] });
        expect(result.ingredients).toEqual([{ name: 'eggs', quantity: 4, unit: 'pcs' }]);
    });

    it('drops a non-numeric quantity rather than emitting NaN', () => {
        const result = parse({
            title: 'X',
            ingredients: [{ name: 'onion', quantity: 'one', unit: 'pcs' }],
            instructions: ['Do.'],
        });

        expect(result.ingredients).toEqual([{ name: 'onion' }]);
    });

    it('drops a non-finite numeric quantity rather than emitting NaN or Infinity', () => {
        expect(
            parse({
                title: 'X',
                ingredients: [{ name: 'flour', quantity: Number.POSITIVE_INFINITY, unit: 'g' }],
                instructions: ['Do.'],
            }).ingredients
        ).toEqual([{ name: 'flour' }]);
        expect(
            parse({
                title: 'X',
                ingredients: [{ name: 'flour', quantity: Number.NaN, unit: 'g' }],
                instructions: ['Do.'],
            }).ingredients
        ).toEqual([{ name: 'flour' }]);
    });

    it('defaults a blank-string unit to pcs when a quantity is given', () => {
        const result = parse({
            title: 'X',
            ingredients: [{ name: 'eggs', quantity: 3, unit: '   ' }],
            instructions: ['Do.'],
        });

        expect(result.ingredients).toEqual([{ name: 'eggs', quantity: 3, unit: 'pcs' }]);
    });

    it('keeps a zero quantity rather than dropping it as falsy', () => {
        const result = parse({
            title: 'X',
            ingredients: [{ name: 'salt', quantity: 0, unit: 'g' }],
            instructions: ['Do.'],
        });

        expect(result.ingredients).toEqual([{ name: 'salt', quantity: 0, unit: 'g' }]);
    });

    it('drops non-string instruction entries', () => {
        const result = parse({
            title: 'X',
            ingredients: [{ name: 'salt' }],
            instructions: ['Do.', 5, 'Then.'],
        });

        expect(result.instructions).toEqual(['Do.', 'Then.']);
    });

    it('defaults instructions to an empty array when absent or wrong-typed', () => {
        expect(parse({ title: 'X', ingredients: [{ name: 'salt' }] }).instructions).toEqual([]);
        expect(parse({ title: 'X', ingredients: [{ name: 'salt' }], instructions: 'nope' }).instructions).toEqual([]);
    });

    it('rejects a missing, non-array or empty ingredients list', () => {
        expect(() => parse({ title: 'X', instructions: [] })).toThrow();
        expect(() => parse({ title: 'X', ingredients: 'nope', instructions: [] })).toThrow();
        expect(() => parse({ title: 'X', ingredients: [], instructions: [] })).toThrow();
    });

    it('rejects an ingredient with no usable name', () => {
        expect(() => parse({ title: 'X', ingredients: [{ quantity: 1 }], instructions: [] })).toThrow();
        expect(() => parse({ title: 'X', ingredients: [{ name: '   ' }], instructions: [] })).toThrow();
    });
});
