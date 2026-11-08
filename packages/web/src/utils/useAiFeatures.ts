import { useEffect, useState } from 'react';

export interface AiFeatures {
    imageGeneration: boolean;
    recipeImport: boolean;
    ingredientSubstitutes: boolean;
    itemCategorisation: boolean;
    itemParse: boolean;
    recipeTagger: boolean;
}

export interface AuthFeatures {
    googleSignIn: boolean;
}

type ServerFeatures = AiFeatures & AuthFeatures;

// fallow-ignore-next-line unused-export
export const DEFAULT_AI_FEATURES: AiFeatures = {
    imageGeneration: false,
    recipeImport: false,
    ingredientSubstitutes: false,
    itemCategorisation: false,
    itemParse: false,
    recipeTagger: false,
};

const DEFAULT_FEATURES: ServerFeatures = { ...DEFAULT_AI_FEATURES, googleSignIn: false };

let cached: { value: ServerFeatures } | null = null;
let inflight: Promise<ServerFeatures> | null = null;

const fetchFeatures = async (): Promise<ServerFeatures> => {
    if (cached) return cached.value;

    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const res = await fetch('/api/features');

            if (!res.ok) {
                return DEFAULT_FEATURES;
            }

            // SAFETY: /api/features answers with a subset of ServerFeatures; missing keys fall back to DEFAULT_FEATURES in the merge below.
            const data = (await res.json()) as Partial<ServerFeatures>;
            const merged: ServerFeatures = { ...DEFAULT_FEATURES, ...data };
            cached = { value: merged };

            return merged;
        } catch {
            return DEFAULT_FEATURES;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
};

const useServerFeatures = (): ServerFeatures => {
    const [features, setFeatures] = useState<ServerFeatures>(() => cached?.value ?? DEFAULT_FEATURES);
    useEffect(() => {
        let cancelled = false;
        fetchFeatures().then((value) => {
            if (!cancelled) setFeatures(value);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return features;
};

/**
 * Reports which AI features the API has wired. When FAL_KEY is empty the
 * server returns all-false; the hook then drives hiding of the import-by-link
 * button, the recipe/image generator and the ingredient-substitutes popover,
 * with a short "Not available on this server" note.
 */
export const useAiFeatures = (): AiFeatures => useServerFeatures();

/** Reports which sign-in options the API offers: Google only when `GOOGLE_CLIENT_ID`/`_SECRET` are set. */
export const useAuthFeatures = (): AuthFeatures => useServerFeatures();
