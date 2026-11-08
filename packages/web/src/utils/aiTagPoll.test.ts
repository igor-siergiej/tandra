import type { Recipe } from '@tandra/types';
import { describe, expect, it } from 'vitest';

import { aiTagPollInterval } from './aiTagPoll';

const recipe = (over: Partial<Recipe>): Recipe => ({
    id: 'r',
    title: 'T',
    ingredients: [],
    users: [],
    ownerId: 'u',
    dateAdded: new Date(),
    ...over,
});

describe('aiTagPollInterval', () => {
    it('polls while a just-created recipe has no tags yet', () => {
        expect(aiTagPollInterval(recipe({}))).toBe(3000);
    });

    it('stops once the recipe has tags', () => {
        expect(aiTagPollInterval(recipe({ tags: ['pasta'] }))).toBe(false);
    });

    it('does not poll for an old untagged recipe', () => {
        expect(aiTagPollInterval(recipe({ dateAdded: new Date(Date.now() - 5 * 60_000) }))).toBe(false);
    });

    it('polls a list when any recent recipe is still untagged', () => {
        expect(aiTagPollInterval([recipe({ tags: ['x'] }), recipe({ id: 'b' })])).toBe(3000);
    });

    it('does not poll without data', () => {
        expect(aiTagPollInterval(undefined)).toBe(false);
        expect(aiTagPollInterval(null)).toBe(false);
    });
});
