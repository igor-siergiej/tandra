import type { Recipe } from '@tandra/types';

const TAGGING_WINDOW_MS = 60_000;
const TAGGING_POLL_MS = 3000;

// The API tags a new recipe in the background; poll briefly while a just-created recipe still has none.
const awaitingAiTags = (recipes: Array<Recipe> | Recipe | null | undefined): boolean => {
    const now = Date.now();

    return [recipes ?? []]
        .flat()
        .some((r) => !r.tags?.length && now - new Date(r.dateAdded).getTime() < TAGGING_WINDOW_MS);
};

export const aiTagPollInterval = (recipes: Array<Recipe> | Recipe | null | undefined): number | false =>
    awaitingAiTags(recipes) ? TAGGING_POLL_MS : false;
