import type { RecipeImportResult } from '@tandra/types';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../api', () => ({
    importRecipeImage: vi.fn().mockRejectedValue(new Error('no image')),
}));

import { applyImportedDraft, type DraftSetters } from './applyImportedDraft';

const makeSetters = (): DraftSetters => ({
    setTitle: vi.fn(),
    setLink: vi.fn(),
    setIngredients: vi.fn(),
    setShowIngredientsPaste: vi.fn(),
    setSteps: vi.fn(),
    setShowPasteArea: vi.fn(),
    setSelectedFile: vi.fn(),
    setImageUrl: vi.fn(),
    setPrepTime: vi.fn(),
    setCookTime: vi.fn(),
    setServings: vi.fn(),
});

const draft: RecipeImportResult = {
    title: 'Cake',
    link: 'https://example.com/cake',
    instructions: ['Mix', 'Bake'],
    ingredients: [
        { id: '1', name: 'Butter', quantity: 4, unit: 'oz' },
        { id: '2', name: 'Salt' },
    ],
};

describe('applyImportedDraft unit conversion', () => {
    beforeEach(() => vi.clearAllMocks());

    it('leaves imported units untouched by default', async () => {
        const setters = makeSetters();
        await applyImportedDraft(draft, setters);

        expect(setters.setIngredients).toHaveBeenCalledWith([
            { name: 'Butter', quantity: 4, unit: 'oz' },
            { name: 'Salt', quantity: undefined, unit: undefined },
        ]);
    });

    it('converts convertible ingredients to the chosen system', async () => {
        const setters = makeSetters();
        await applyImportedDraft(draft, setters, 'metric');

        expect(setters.setIngredients).toHaveBeenCalledWith([
            { name: 'Butter', quantity: 113, unit: 'g' },
            { name: 'Salt', quantity: undefined, unit: undefined },
        ]);
    });
});

describe('applyImportedDraft timing and servings prefill', () => {
    beforeEach(() => vi.clearAllMocks());

    it('parses prepTime, cookTime and recipeYield into the real form fields', async () => {
        const setters = makeSetters();
        await applyImportedDraft({ ...draft, prepTime: 'PT20M', cookTime: 'PT1H', recipeYield: '8 servings' }, setters);

        expect(setters.setPrepTime).toHaveBeenCalledWith('20');
        expect(setters.setCookTime).toHaveBeenCalledWith('60');
        expect(setters.setServings).toHaveBeenCalledWith('8');
    });

    it('does not touch timing/servings setters when the import found none', async () => {
        const setters = makeSetters();
        await applyImportedDraft(draft, setters);

        expect(setters.setPrepTime).not.toHaveBeenCalled();
        expect(setters.setCookTime).not.toHaveBeenCalled();
        expect(setters.setServings).not.toHaveBeenCalled();
    });
});
