// Parses the raw strings RecipeImportService scrapes from schema.org JSON-LD
// (packages/api/src/domain/RecipeImportService) into the numbers persisted on Recipe.
// Kept on the web side, not the API: the transient RecipeImportResult DTO stays raw
// strings so its own extraction coverage is unaffected by how a consumer interprets them.

// schema.org prepTime/cookTime are ISO-8601 durations ("PT20M", "PT1H30M", "PT2H").
// Falls back to the first number found in the string (treated as minutes) for the
// occasional page that emits plain text ("20 mins") instead of a spec-compliant duration.
// fallow-ignore-next-line complexity
export const parseDurationMinutes = (value: string): number | undefined => {
    const iso = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(value.trim());

    if (iso && (iso[1] !== undefined || iso[2] !== undefined)) {
        const hours = Number(iso[1] ?? 0);
        const minutes = Number(iso[2] ?? 0);

        return hours * 60 + minutes;
    }

    const fallback = /(\d+)/.exec(value);

    return fallback ? Number(fallback[1]) : undefined;
};

// schema.org recipeYield is a loose string ("8 servings", "Serves 4", "4-6"). Takes the
// first number found — the low end for a range, which is what "servings" should scale from.
export const parseServings = (value: string): number | undefined => {
    const match = /(\d+)/.exec(value);

    return match ? Number(match[1]) : undefined;
};

// Empty input -> undefined (field left unset); a non-numeric or negative value also -> undefined
// so a stray keystroke silently drops instead of persisting NaN or a garbage negative duration.
// Shared by AddRecipePage and RecipeDetailsSection, both of which parse the same numeric
// text-input fields (prep time / cook time / servings) into an optional persisted number.
export const toOptionalNumber = (value: string): number | undefined => {
    const trimmed = value.trim();

    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
