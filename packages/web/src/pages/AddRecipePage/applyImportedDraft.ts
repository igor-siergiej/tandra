import type { RecipeImportResult } from '@tandra/types';

import { importRecipeImage } from '../../api';
import { convertIngredients, type UnitSystem } from '../../utils/convertUnits';
import { logger } from '../../utils/logger';
import { parseDurationMinutes, parseServings } from '../../utils/parseRecipeMeta';
import type { Ingredient } from './IngredientsField';

export interface DraftSetters {
    setTitle: (title: string) => void;
    setLink: (link: string) => void;
    setIngredients: (ingredients: Ingredient[]) => void;
    setShowIngredientsPaste: (show: boolean) => void;
    setSteps: (steps: string[]) => void;
    setShowPasteArea: (show: boolean) => void;
    setSelectedFile: (file: File | null) => void;
    setImageUrl: (url: string | null) => void;
    setPrepTime: (value: string) => void;
    setCookTime: (value: string) => void;
    setServings: (value: string) => void;
}

const applyBasicFields = (draft: RecipeImportResult, setters: DraftSetters): void => {
    if (draft.title) setters.setTitle(draft.title);

    if (draft.link) setters.setLink(draft.link);
};

const applyIngredientsAndInstructions = (
    draft: RecipeImportResult,
    setters: DraftSetters,
    unitSystem: UnitSystem
): void => {
    if (draft.ingredients.length > 0) {
        const ingredients = draft.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit }));
        setters.setIngredients(convertIngredients(ingredients, unitSystem));
        setters.setShowIngredientsPaste(false);
    }

    if (draft.instructions.length > 0) {
        setters.setSteps(draft.instructions);
        setters.setShowPasteArea(false);
    }
};

export interface ApplyDraftOptions {
    signal?: AbortSignal;
    // Called just before the cover-image request starts, so callers can surface that
    // second leg — it only runs when the scrape actually found an image.
    onImageStart?: () => void;
}

// Resolves to undefined when the cover image couldn't be fetched for an ordinary reason
// (dead link, blocked host, proxy error) — that is a soft failure, since the rest of the
// import already succeeded and manual upload stays available. An aborted fetch is not:
// it propagates so a cancelled import is dropped instead of half-applied.
const fetchCoverImage = async (url: string, signal?: AbortSignal): Promise<File | undefined> => {
    try {
        return await importRecipeImage(url, signal);
    } catch (imageErr) {
        if (signal?.aborted) throw imageErr;

        logger.warn('Failed to auto-attach scraped recipe image', { error: String(imageErr) });

        return undefined;
    }
};

const applyScrapedImage = async (
    draft: RecipeImportResult,
    setters: DraftSetters,
    options: ApplyDraftOptions
): Promise<void> => {
    if (!draft.image) return;

    options.onImageStart?.();

    const file = await fetchCoverImage(draft.image, options.signal);

    if (!file) return;

    setters.setSelectedFile(file);
    setters.setImageUrl(URL.createObjectURL(file));
};

// Prefills the real prepTime/cookTime/servings form fields (still user-editable before
// save) by parsing the raw schema.org strings the import found. Difficulty has no
// schema.org source, so it stays manual-only and is never touched here.
// fallow-ignore-next-line complexity
const applyTimingAndServings = (draft: RecipeImportResult, setters: DraftSetters): void => {
    if (draft.prepTime !== undefined) {
        const minutes = parseDurationMinutes(draft.prepTime);

        if (minutes !== undefined) setters.setPrepTime(String(minutes));
    }

    if (draft.cookTime !== undefined) {
        const minutes = parseDurationMinutes(draft.cookTime);

        if (minutes !== undefined) setters.setCookTime(String(minutes));
    }

    if (draft.recipeYield !== undefined) {
        const servings = parseServings(draft.recipeYield);

        if (servings !== undefined) setters.setServings(String(servings));
    }
};

// Applies a successfully-fetched recipe draft to form state. Only touches fields the
// draft actually found, leaving anything else the user may have already entered intact.
export const applyImportedDraft = async (
    draft: RecipeImportResult,
    setters: DraftSetters,
    unitSystem: UnitSystem = 'original',
    options: ApplyDraftOptions = {}
): Promise<void> => {
    applyBasicFields(draft, setters);
    applyIngredientsAndInstructions(draft, setters, unitSystem);
    await applyScrapedImage(draft, setters, options);
    applyTimingAndServings(draft, setters);
};
