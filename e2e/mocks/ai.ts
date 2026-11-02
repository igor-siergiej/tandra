import type { Page, Route } from '@playwright/test';

export interface ImportedRecipe {
    title: string;
    link?: string;
    instructions?: Array<string>;
    ingredients?: Array<{ id?: string; name: string; quantity?: number; unit?: string }>;
    [key: string]: unknown;
}

export type MockOutcome<T> = { ok: T; delayMs?: number } | { status: number; error: string; delayMs?: number };

const respond = async <T>(route: Route, outcome: MockOutcome<T>) => {
    if (outcome.delayMs) await new Promise((resolve) => setTimeout(resolve, outcome.delayMs));

    if ('ok' in outcome) return route.fulfill({ json: outcome.ok });

    return route.fulfill({ status: outcome.status, json: { error: outcome.error } });
};

export const mockRecipeImport = (page: Page, outcome: MockOutcome<ImportedRecipe>) =>
    page.route('**/api/recipes/import', (route) => respond(route, outcome));

export const mockSubstitutes = (page: Page, outcome: MockOutcome<{ substitutes: Array<string> }>) =>
    page.route('**/api/recipes/substitutes', (route) => respond(route, outcome));

export const mockSpokenItemsParse = (
    page: Page,
    outcome: MockOutcome<{ items: Array<{ name: string; quantity?: number; unit?: string }> }>
) => page.route('**/api/items/parse', (route) => respond(route, outcome));

/** Stubs POST /api/recipes/:id/image/generate; the response is the updated recipe. */
export const mockRecipeCoverGeneration = (page: Page, outcome: MockOutcome<Record<string, unknown>>) =>
    page.route(/\/api\/recipes\/[^/]+\/image\/generate$/, (route) => respond(route, outcome));

export const mockRateLimited = (page: Page, urlGlob: string) =>
    page.route(urlGlob, (route) =>
        route.fulfill({ status: 429, json: { error: 'Too many AI requests. Try again later.' } })
    );
