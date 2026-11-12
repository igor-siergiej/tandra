interface IngredientSubstituter {
    generateSubstitutes(ingredientName: string, recipeTitle?: string): Promise<string[]>;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 5000;

interface CacheOptions {
    ttlMs?: number;
    maxEntries?: number;
    now?: () => number;
}

const normalise = (value?: string) => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Memoises substitutes by normalised ingredient + recipe title so repeat taps never reach the LLM. */
export class CachedIngredientSubstituter implements IngredientSubstituter {
    private readonly entries = new Map<string, { value: string[]; expiresAt: number }>();
    private readonly ttlMs: number;
    private readonly maxEntries: number;
    private readonly now: () => number;

    constructor(
        private readonly inner: IngredientSubstituter,
        options: CacheOptions = {}
    ) {
        this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
        this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.now = options.now ?? Date.now;
    }

    // Invoked via the IngredientSubstituter interface through the DI container; cache check, call-through and bounded
    // insert read best as one method.
    // fallow-ignore-next-line complexity, unused-class-member
    async generateSubstitutes(ingredientName: string, recipeTitle?: string): Promise<string[]> {
        const key = `${normalise(ingredientName)}|${normalise(recipeTitle)}`;
        const hit = this.entries.get(key);

        if (hit && hit.expiresAt > this.now()) {
            return [...hit.value];
        }

        const value = await this.inner.generateSubstitutes(ingredientName, recipeTitle);

        if (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;

            if (oldest !== undefined) this.entries.delete(oldest);
        }

        this.entries.set(key, { value: [...value], expiresAt: this.now() + this.ttlMs });

        return value;
    }
}
