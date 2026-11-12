import { describe, expect, it } from 'bun:test';

import {
    isMergeableIngredient,
    normalizeIngredientName,
    resolveMergedQuantity,
    resolveMergedUnit,
} from './ingredientMatching';

describe('normalizeIngredientName', () => {
    it('lowercases and trims', () => {
        expect(normalizeIngredientName('  Eggs  ')).toBe('egg');
    });

    it('strips a leading descriptor word', () => {
        expect(normalizeIngredientName('Large Eggs')).toBe('egg');
    });

    it('strips a trailing descriptor word', () => {
        expect(normalizeIngredientName('Onion diced')).toBe('onion');
    });

    it('singularizes so plural and singular forms match', () => {
        expect(normalizeIngredientName('Onions')).toBe(normalizeIngredientName('Onion'));
    });

    it('does not strip a trailing "ss"', () => {
        expect(normalizeIngredientName('Swiss cheese')).toBe('swiss cheese');
    });

    it('leaves genuinely different ingredients distinct', () => {
        expect(normalizeIngredientName('Eggs')).not.toBe(normalizeIngredientName('Egg noodles'));
    });
});

describe('isMergeableIngredient', () => {
    it('matches identical names with no unit', () => {
        expect(isMergeableIngredient({ name: 'Milk' }, { name: 'milk' })).toBe(true);
    });

    it('matches a descriptor-qualified name against the bare ingredient', () => {
        expect(isMergeableIngredient({ name: 'eggs' }, { name: 'large eggs' })).toBe(true);
    });

    it('treats "pcs" and no unit as the same unit bucket', () => {
        expect(isMergeableIngredient({ name: 'eggs', unit: 'pcs' }, { name: 'eggs' })).toBe(true);
    });

    it('treats different count-synonym units as compatible', () => {
        expect(isMergeableIngredient({ name: 'eggs', unit: 'pcs' }, { name: 'eggs', unit: 'each' })).toBe(true);
    });

    it('does not merge genuinely different measurement units', () => {
        expect(isMergeableIngredient({ name: 'flour', unit: 'g' }, { name: 'flour', unit: 'ml' })).toBe(false);
    });

    it('does not merge unrelated ingredients', () => {
        expect(isMergeableIngredient({ name: 'eggs' }, { name: 'milk' })).toBe(false);
    });
});

describe('resolveMergedQuantity', () => {
    it('sums two present quantities', () => {
        expect(resolveMergedQuantity(5, 2)).toBe(7);
    });

    it('treats a missing quantity as zero when the other side has one', () => {
        expect(resolveMergedQuantity(5, undefined)).toBe(5);
        expect(resolveMergedQuantity(undefined, 2)).toBe(2);
    });

    it('stays undefined when neither side tracked a quantity', () => {
        expect(resolveMergedQuantity(undefined, undefined)).toBeUndefined();
    });
});

describe('resolveMergedUnit', () => {
    it('keeps the existing unit when present', () => {
        expect(resolveMergedUnit('pcs', undefined)).toBe('pcs');
    });

    it('adopts the incoming unit when the existing item had none', () => {
        expect(resolveMergedUnit(undefined, 'pcs')).toBe('pcs');
    });

    it('stays undefined when neither side has a unit', () => {
        expect(resolveMergedUnit(undefined, undefined)).toBeUndefined();
    });
});
