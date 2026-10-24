/** Default read/write alias; the concrete index behind it is swapped atomically by a reindex. */
export const DEFAULT_INDEX_ALIAS = 'discovery-recipes';

/**
 * Equivalent-ingredient groups, applied at query time only (see `recipe_search`). Index-time stays literal, so editing
 * this list never needs a reindex. British / American names are the usual way a search for one misses the other.
 */
const INGREDIENT_SYNONYMS = [
    'aubergine, eggplant',
    'courgette, zucchini',
    'coriander, cilantro',
    'rocket, arugula',
    'prawn, shrimp',
    'chickpea, garbanzo bean',
    'icing sugar, powdered sugar, confectioners sugar',
    'caster sugar, superfine sugar',
    'plain flour, all purpose flour',
    'double cream, heavy cream',
    'spring onion, scallion, green onion',
    'swede, rutabaga',
    'mince, ground meat',
    'bicarbonate of soda, baking soda',
];

export const indexBody = {
    settings: {
        number_of_shards: 1,
        // Single-node deployment: a replica could never be assigned and would hold the cluster at yellow.
        number_of_replicas: 0,
        analysis: {
            filter: {
                recipe_ascii_folding: { type: 'asciifolding' },
                recipe_stemmer: { type: 'stemmer', language: 'english' },
                ingredient_synonyms: { type: 'synonym_graph', synonyms: INGREDIENT_SYNONYMS },
            },
            analyzer: {
                // Index time: lowercase -> fold accents (jalapeno/jalapeño) -> stem (tomatoes/tomato).
                recipe_text: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'recipe_ascii_folding', 'recipe_stemmer'],
                },
                // Query time: same chain plus synonyms before stemming, so both sides of a synonym stem identically.
                recipe_search: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'recipe_ascii_folding', 'ingredient_synonyms', 'recipe_stemmer'],
                },
            },
            normalizer: {
                // For keyword fields (tags, facet values): case- and accent-insensitive exact match.
                keyword_folded: { type: 'custom', filter: ['lowercase', 'recipe_ascii_folding'] },
            },
        },
    },
    mappings: {
        // Unknown fields are an error, not a silently inferred mapping.
        dynamic: 'strict',
        properties: {
            id: { type: 'keyword' },
            title: {
                type: 'text',
                analyzer: 'recipe_text',
                search_analyzer: 'recipe_search',
                fields: { keyword: { type: 'keyword', normalizer: 'keyword_folded', ignore_above: 256 } },
            },
            // One entry per ingredient. The position gap stops a phrase matching across two different ingredients.
            ingredientNames: {
                type: 'text',
                analyzer: 'recipe_text',
                search_analyzer: 'recipe_search',
                position_increment_gap: 100,
                fields: { keyword: { type: 'keyword', normalizer: 'keyword_folded', ignore_above: 256 } },
            },
            tags: {
                type: 'keyword',
                normalizer: 'keyword_folded',
                fields: { text: { type: 'text', analyzer: 'recipe_text', search_analyzer: 'recipe_search' } },
            },
            prepTime: { type: 'integer' },
            cookTime: { type: 'integer' },
            // prepTime + cookTime, derived at index time so time filters and the time facet are plain range queries.
            totalTime: { type: 'integer' },
            servings: { type: 'integer' },
            difficulty: { type: 'keyword' },
            source: { type: 'keyword' },
            estimated: { type: 'keyword' },
            coverImageKey: { type: 'keyword', index: false },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
        },
    },
} as const;
