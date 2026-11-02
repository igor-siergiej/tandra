import { describe, expect, it, vi } from 'bun:test';

import { CachedIngredientSubstituter } from './index';

const setup = (options = {}) => {
    const inner = { generateSubstitutes: vi.fn().mockResolvedValue(['oat milk', 'soy milk']) };
    return { inner, cache: new CachedIngredientSubstituter(inner, options) };
};

describe('CachedIngredientSubstituter', () => {
    it('serves a repeat request from cache, normalising case and whitespace', async () => {
        const { inner, cache } = setup();

        await cache.generateSubstitutes('Milk', 'Pancakes');
        const again = await cache.generateSubstitutes('  milk ', ' pancakes');

        expect(again).toEqual(['oat milk', 'soy milk']);
        expect(inner.generateSubstitutes).toHaveBeenCalledTimes(1);
    });

    it('keys on the recipe context as well as the ingredient', async () => {
        const { inner, cache } = setup();

        await cache.generateSubstitutes('milk', 'Pancakes');
        await cache.generateSubstitutes('milk', 'Bechamel');
        await cache.generateSubstitutes('milk');

        expect(inner.generateSubstitutes).toHaveBeenCalledTimes(3);
    });

    it('refetches after the entry expires', async () => {
        let now = 0;
        const { inner, cache } = setup({ ttlMs: 1000, now: () => now });

        await cache.generateSubstitutes('milk');
        now = 1001;
        await cache.generateSubstitutes('milk');

        expect(inner.generateSubstitutes).toHaveBeenCalledTimes(2);
    });

    it('evicts the oldest entry when full', async () => {
        const { inner, cache } = setup({ maxEntries: 1 });

        await cache.generateSubstitutes('milk');
        await cache.generateSubstitutes('egg');
        await cache.generateSubstitutes('milk');

        expect(inner.generateSubstitutes).toHaveBeenCalledTimes(3);
    });

    it('does not cache failures', async () => {
        const { inner, cache } = setup();
        inner.generateSubstitutes.mockRejectedValueOnce(new Error('llm down'));

        await expect(cache.generateSubstitutes('milk')).rejects.toThrow('llm down');
        await expect(cache.generateSubstitutes('milk')).resolves.toEqual(['oat milk', 'soy milk']);
    });

    it('returns copies so callers cannot corrupt the cache', async () => {
        const { cache } = setup();
        const first = await cache.generateSubstitutes('milk');
        first.push('mutated');

        expect(await cache.generateSubstitutes('milk')).toEqual(['oat milk', 'soy milk']);
    });
});
