import { ConfigService, parsers } from '@imapps/api-utils';

const schema = {
    port: { parser: parsers.number, from: 'PORT' },
    betterAuthSecret: { parser: parsers.string, from: 'BETTER_AUTH_SECRET' },
    betterAuthUrl: { parser: parsers.string, from: 'BETTER_AUTH_URL' },
    googleClientId: { parser: parsers.string, from: 'GOOGLE_CLIENT_ID', optional: true },
    googleClientSecret: { parser: parsers.string, from: 'GOOGLE_CLIENT_SECRET', optional: true },
    connectionUri: { parser: parsers.string, from: 'CONNECTION_URI' },
    databaseName: { parser: parsers.string, from: 'DATABASE_NAME' },
    falKey: { parser: parsers.string, from: 'FAL_KEY', optional: true },
    falModel: { parser: parsers.string, from: 'FAL_MODEL', optional: true },
    falRecipeModel: { parser: parsers.string, from: 'FAL_RECIPE_MODEL', optional: true },
    recipeImportLlmEnabled: { parser: parsers.boolean, from: 'RECIPE_IMPORT_LLM_ENABLED', optional: true },
    recipeImportLlmFirst: { parser: parsers.boolean, from: 'RECIPE_IMPORT_LLM_FIRST', optional: true },
    recipeImportLlmApiKey: { parser: parsers.string, from: 'RECIPE_IMPORT_LLM_API_KEY', optional: true },
    recipeImportLlmModel: { parser: parsers.string, from: 'RECIPE_IMPORT_LLM_MODEL', optional: true },
    bucketName: { parser: parsers.string, from: 'BUCKET_NAME' },
    bucketAccessKey: { parser: parsers.string, from: 'BUCKET_ACCESS_KEY' },
    bucketSecretKey: { parser: parsers.string, from: 'BUCKET_SECRET_KEY' },
    bucketEndpoint: { parser: parsers.string, from: 'BUCKET_ENDPOINT' },
    vapidPublicKey: { parser: parsers.string, from: 'VAPID_PUBLIC_KEY', optional: true },
    vapidPrivateKey: { parser: parsers.string, from: 'VAPID_PRIVATE_KEY', optional: true },
    vapidSubject: { parser: parsers.string, from: 'VAPID_SUBJECT', optional: true },
    wikibooksUserAgent: { parser: parsers.string, from: 'WIKIBOOKS_USER_AGENT', optional: true },
    discoveryAdminUserIds: { parser: parsers.string, from: 'DISCOVERY_ADMIN_USER_IDS', optional: true },
    opensearchUrl: { parser: parsers.string, from: 'OPENSEARCH_URL', optional: true },
    // Alias the discovery index lives under (default `discovery-recipes`); lets several API instances share one engine.
    opensearchIndex: { parser: parsers.string, from: 'OPENSEARCH_INDEX', optional: true },
    // Comma-separated list of origins allowed to call the public read-only
    // /api/public/discover/* endpoints. The marketing site is the primary
    // consumer; localhost is included so the selfhost compose works out of
    // the box without a custom env var.
    publicDiscoverOrigins: {
        parser: parsers.string,
        from: 'PUBLIC_DISCOVER_ORIGINS',
        optional: true,
    },
} as const;

export const config = new ConfigService(schema);

/**
 * Snapshot of which AI features the api is wired to call. Used by the
 * `/api/features` endpoint to tell the web which controls to hide when the
 * server is self-hosted without FAL_KEY / RECIPE_IMPORT_LLM_API_KEY.
 */
export interface AiFeaturesSummary {
    imageGeneration: boolean;
    recipeImport: boolean;
    ingredientSubstitutes: boolean;
    itemCategorisation: boolean;
    itemParse: boolean;
    recipeTagger: boolean;
}

/**
 * Pure helper: turn the env at call time into the feature flags the web
 * reads. Kept separate from `config` so tests can drive it without going
 * through the full ConfigService cache.
 */
export const aiFeaturesFromEnv = (env: NodeJS.ProcessEnv = process.env): AiFeaturesSummary => {
    const falKey = env.FAL_KEY ?? '';
    const llmKey = env.RECIPE_IMPORT_LLM_API_KEY ?? '';
    const imageGeneration = falKey.length > 0;
    const llm = falKey.length > 0 || llmKey.length > 0;
    return {
        imageGeneration,
        recipeImport: llm,
        ingredientSubstitutes: llm,
        itemCategorisation: llm,
        itemParse: llm,
        recipeTagger: llm,
    };
};

/**
 * Snapshot of which auth features the api exposes. Used by `/api/features`
 * to tell the web which auth-related controls to surface (today only the
 * Google sign-in button).
 */
export interface AuthFeaturesSummary {
    googleSignIn: boolean;
}

/**
 * Pure helper: turn the env at call time into the auth feature flags the
 * web reads. Kept separate from `config` so tests can drive it without
 * going through the full ConfigService cache.
 */
export const authFeaturesFromEnv = (env: NodeJS.ProcessEnv = process.env): AuthFeaturesSummary => ({
    googleSignIn: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
});
