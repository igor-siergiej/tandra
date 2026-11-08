import { expect, test } from '../fixtures';

test.describe('AI features endpoint', () => {
    test('@smoke /api/features reports the current AI feature set', async ({ request }) => {
        const res = await request.get('/api/features');
        expect(res.status()).toBe(200);
        const body: Record<string, boolean> = await res.json();

        // Each flag is a boolean; presence is what the web reads on boot.
        for (const key of [
            'imageGeneration',
            'recipeImport',
            'ingredientSubstitutes',
            'itemCategorisation',
            'itemParse',
            'recipeTagger',
        ]) {
            expect(body[key]).toEqual(expect.any(Boolean));
        }
    });
});
