import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every mutating route that takes a JSON body must be wired to a Zod schema. Routes below legitimately have no JSON
// body (path-only actions, multipart uploads, or ingestion that rate-limits before parsing).
const NO_JSON_BODY = new Set([
    'delete /api/lists/:title',
    'delete /api/lists/:title/items/:itemId',
    'delete /api/lists/:title/clear',
    'delete /api/lists/:title/clearSelected',
    'delete /api/lists/:title/users/:userId',
    'post /api/lists/:title/socket-ticket',
    'delete /api/recipes/:recipeId',
    'delete /api/recipes/:recipeId/users/:targetUserId',
    'post /api/recipes/:recipeId/image/upload',
    'post /api/recipes/:recipeId/image/generate',
    'post /api/recipes/:recipeId/image/revert',
    'post /api/discover/recipes/:id/copy',
    'delete /api/discover/recipes/:id',
    'delete /api/discover/published/:id',
    'delete /api/meal-plan/:id',
    'delete /api/todos/:id',
    'delete /api/labels/:id',
    'post /api/friends/code',
    'delete /api/friends/:friendId',
    'post /api/logs',
    'post /api/lists/:title/invites',
    'post /api/lists/invites/:token/redeem',
    'delete /api/lists/invites/:token',
]);

const source = readFileSync(join(import.meta.dir, 'index.ts'), 'utf8');

const routes = [...source.matchAll(/router\.(put|post|delete)\(\s*'([^']+)',([^;]*?)\);/gs)].map((match) => ({
    key: `${match[1]} ${match[2]}`,
    validated: match[3].includes('validateJson('),
}));

describe('route body validation', () => {
    it('found the mutating routes', () => {
        expect(routes.length).toBeGreaterThan(30);
    });

    it('validates the JSON body of every mutating route that takes one', () => {
        const unvalidated = routes.filter((route) => !route.validated && !NO_JSON_BODY.has(route.key));

        expect(unvalidated.map((route) => route.key)).toEqual([]);
    });

    it('does not list a body-less exemption for a route that is validated', () => {
        const stale = routes.filter((route) => route.validated && NO_JSON_BODY.has(route.key));

        expect(stale.map((route) => route.key)).toEqual([]);
    });
});
