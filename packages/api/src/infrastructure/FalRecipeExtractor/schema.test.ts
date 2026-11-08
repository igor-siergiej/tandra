import { describe, expect, it } from 'bun:test';

import { extractedRecipeSchema } from './schema';

// The schema is the boundary decoder for a model reply, so the tests feed it raw values of any shape.
const parse: typeof extractedRecipeSchema.parse = (input) => extractedRecipeSchema.parse(input);

describe('extractedRecipeSchema', () => {
    it('keeps string arrays as-is and leaves the title untrimmed', () => {
        const result = parse({ title: ' Soup ', ingredients: ['1 onion', '2 carrots'], instructions: ['Boil.'] });
        expect(result).toEqual({ title: ' Soup ', ingredients: ['1 onion', '2 carrots'], instructions: ['Boil.'] });
    });

    it('coerces missing or wrong-typed fields to safe defaults', () => {
        expect(parse({ ingredients: 'not-an-array' })).toEqual({ title: '', ingredients: [], instructions: [] });
        expect(parse({})).toEqual({ title: '', ingredients: [], instructions: [] });
    });

    it('drops non-string entries from the arrays', () => {
        const result = parse({ title: 'X', ingredients: ['a', 2, 'b'], instructions: [true, 'step'] });
        expect(result).toEqual({ title: 'X', ingredients: ['a', 'b'], instructions: ['step'] });
    });
});
