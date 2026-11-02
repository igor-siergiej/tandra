import type { Page } from '@playwright/test';

import { apiCreateRecipe } from '../api-helpers';
import { expect, test } from '../fixtures';

const openWasteWarrior = async (page: Page) => {
    await page.goto('/recipes');
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('button', { name: 'Use Up Ingredient' }).click();
    await page.waitForURL(/\/recipes\/use-up$/);
    await expect(page.getByRole('heading', { name: 'Use Up an Ingredient' })).toBeVisible();
};

test.describe('Waste Warrior', () => {
    test('prompts for an ingredient before showing any results', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Chicken Soup', [{ name: 'chicken' }]);
        await openWasteWarrior(authenticatedPage);
        await expect(authenticatedPage.getByText(/Type something you don't want to waste/)).toBeVisible();
    });

    test('finds recipes that use a fuzzy-matched ingredient and navigates to it', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Spinach Curry', [{ name: 'spinach' }]);
        await apiCreateRecipe('Chicken Soup', [{ name: 'chicken' }]);
        await openWasteWarrior(authenticatedPage);

        await authenticatedPage.getByPlaceholder('e.g. spinach').fill('spinch');
        await expect(authenticatedPage.getByText('Spinach Curry')).toBeVisible();
        await expect(authenticatedPage.getByText('uses spinach')).toBeVisible();
        await expect(authenticatedPage.getByText('Chicken Soup')).not.toBeVisible();

        await authenticatedPage.getByText('Spinach Curry').click();
        await authenticatedPage.waitForURL(/\/recipes\/(?!use-up).+/);
    });

    test('shows a clear empty state when no recipe uses the ingredient', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Chicken Soup', [{ name: 'chicken' }]);
        await openWasteWarrior(authenticatedPage);

        await authenticatedPage.getByPlaceholder('e.g. spinach').fill('durian');
        await expect(authenticatedPage.getByText(/No recipes use anything like/)).toBeVisible();
    });
});
