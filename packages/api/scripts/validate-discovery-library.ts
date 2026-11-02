/**
 * Checks the Wikibooks half of the discovery library: how many recipes it holds and whether each one carries every
 * field the contract requires. Exits non-zero when any is missing.
 *
 *   bun run discover:validate            (from the repo root, reads .env)
 */
import 'dotenv/config';
import type { DiscoveryRecipe } from '@tandra/types';

import { config } from '../src/config';
import { dependencyContainer, registerDepdendencies } from '../src/dependencies';
import { CollectionNames, DependencyToken } from '../src/dependencies/types';

registerDepdendencies();

const database = dependencyContainer.resolve(DependencyToken.Database);
await database.connect({ connectionUri: config.get('connectionUri'), databaseName: config.get('databaseName') });

const recipes = (await database
    .getCollection(CollectionNames.DiscoveryRecipe)
    .find({ source: 'wikibooks' }, { projection: { _id: 0 } })
    .toArray()) as DiscoveryRecipe[];

const nonEmpty = (value: unknown): boolean => (Array.isArray(value) ? value.length > 0 : Boolean(value));
const required = ['title', 'ingredients', 'instructions', 'tags', 'sourceUrl', 'licence', 'attribution'] as const;

const missing = Object.fromEntries(
    required.map((field) => [field, recipes.filter((recipe) => !nonEmpty(recipe[field])).length])
);
const estimatedCount = (field: string) =>
    recipes.filter((recipe) => (recipe.estimated as string[] | undefined)?.includes(field)).length;
const withField = (field: 'prepTime' | 'cookTime' | 'servings' | 'difficulty') =>
    recipes.filter((recipe) => recipe[field] !== undefined).length;

console.log(
    JSON.stringify(
        {
            wikibooksRecipes: recipes.length,
            missingRequiredField: missing,
            withSourceRevision: recipes.filter((recipe) => recipe.sourceRevision !== undefined).length,
            fieldsPresent: Object.fromEntries(
                (['prepTime', 'cookTime', 'servings', 'difficulty'] as const).map((f) => [f, withField(f)])
            ),
            fieldsEstimated: Object.fromEntries(
                ['prepTime', 'cookTime', 'servings', 'difficulty'].map((f) => [f, estimatedCount(f)])
            ),
        },
        null,
        2
    )
);
process.exit(Object.values(missing).some((count) => count > 0) ? 1 : 0);
