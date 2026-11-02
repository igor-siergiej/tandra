import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { ItemCategory } from '@tandra/types';

import { ItemCategoryService } from './index';

const setup = () => {
    const store = new Map<string, ItemCategory>();
    const repo = {
        ensureIndexes: vi.fn(),
        get: vi.fn(async (name: string) => store.get(name) ?? null),
        set: vi.fn(async (name: string, category: ItemCategory) => {
            store.set(name, category);
        }),
    };
    const classifier = { classify: vi.fn().mockResolvedValue('dairy' as ItemCategory) };
    return { repo, classifier, service: new ItemCategoryService(repo, classifier) };
};

describe('ItemCategoryService', () => {
    let ctx: ReturnType<typeof setup>;

    beforeEach(() => {
        ctx = setup();
    });

    it('classifies a new name and remembers it', async () => {
        expect(await ctx.service.categorise('Milk')).toBe('dairy');
        expect(ctx.repo.set).toHaveBeenCalledWith('milk', 'dairy');
    });

    it('classifies each normalised name only once ever', async () => {
        await ctx.service.categorise('Milk');
        await ctx.service.categorise('  milk ');
        await ctx.service.categorise('MILK');

        expect(ctx.classifier.classify).toHaveBeenCalledTimes(1);
    });

    it('returns null and caches nothing when the classifier fails', async () => {
        ctx.classifier.classify.mockRejectedValueOnce(new Error('llm down'));

        expect(await ctx.service.categorise('milk')).toBeNull();
        expect(ctx.repo.set).not.toHaveBeenCalled();
        expect(await ctx.service.categorise('milk')).toBe('dairy');
    });

    it('returns null for an empty name without calling anything', async () => {
        expect(await ctx.service.categorise('   ')).toBeNull();
        expect(ctx.repo.get).not.toHaveBeenCalled();
    });
});
