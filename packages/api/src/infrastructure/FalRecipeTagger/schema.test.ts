import { describe, expect, it } from 'bun:test';

import { taggedRecipeSchema } from './schema';

// The schema is the boundary decoder for a model reply, so the tests feed it raw values of any shape.
const parse: typeof taggedRecipeSchema.parse = (input) => taggedRecipeSchema.parse(input);

describe('taggedRecipeSchema', () => {
    it('keeps a valid tags array as-is', () => {
        expect(parse({ tags: ['pasta', 'egg', 'pork'] })).toEqual({ tags: ['pasta', 'egg', 'pork'] });
    });

    it('coerces missing or wrong-typed tags to an empty array', () => {
        expect(parse({ tags: 'not-an-array' })).toEqual({ tags: [] });
        expect(parse({})).toEqual({ tags: [] });
    });

    it('drops non-string entries from the array', () => {
        expect(parse({ tags: ['pasta', 2, 'egg'] })).toEqual({ tags: ['pasta', 'egg'] });
    });
});
