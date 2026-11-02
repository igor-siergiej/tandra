import type { Page } from '@playwright/test';

import { apiAddItem, apiCreateLabel, apiCreateList, apiCreateRecipe } from '../api-helpers';
import { seedFriendship } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';
import { installFakeSpeech } from '../mocks/speech';
import { settle } from './visual-helpers';

// Fixed Monday so week headings on the meal plan don't depend on the day the suite runs.
const FIXED_NOW = new Date('2026-03-16T09:00:00');

const shot = async (page: Page, name: string) => {
    await settle(page);
    await expect(page).toHaveScreenshot(`${name}.png`);
};

test.describe('Settings page visual regression', () => {
    test('default state', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/settings');
        await expect(authenticatedPage.getByText('Units', { exact: true })).toBeVisible();
        await shot(authenticatedPage, 'settings-default');
    });
});

test.describe('Meal plan visual regression', () => {
    test('empty week', async ({ authenticatedPage }) => {
        await authenticatedPage.clock.setFixedTime(FIXED_NOW);
        await authenticatedPage.goto('/meal-plan');
        await expect(authenticatedPage.getByRole('heading', { name: '16 Mar – 22 Mar' })).toBeVisible();
        await shot(authenticatedPage, 'meal-plan-empty');
    });

    test('populated week', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Weeknight Pasta', [{ name: 'spaghetti', quantity: 200, unit: 'g' }], [], {
            servings: 2,
        });
        await authenticatedPage.clock.setFixedTime(FIXED_NOW);
        await authenticatedPage.goto('/meal-plan');
        await authenticatedPage.getByRole('button', { name: 'Plan a recipe for Monday' }).click();
        await authenticatedPage.getByRole('button', { name: 'Weeknight Pasta' }).click();
        await expect(
            authenticatedPage.getByRole('region', { name: /Monday/ }).getByText('Weeknight Pasta')
        ).toBeVisible();
        await shot(authenticatedPage, 'meal-plan-populated');
    });

    test('shopping preview drawer', async ({ authenticatedPage }) => {
        await apiCreateRecipe(
            'Weeknight Pasta',
            [{ name: 'spaghetti', quantity: 200, unit: 'g' }, { name: 'garlic' }],
            [],
            { servings: 2 }
        );
        await apiCreateList('Weekly Shop');
        await authenticatedPage.clock.setFixedTime(FIXED_NOW);
        await authenticatedPage.goto('/meal-plan');
        await authenticatedPage.getByRole('button', { name: 'Plan a recipe for Monday' }).click();
        await authenticatedPage.getByRole('button', { name: 'Weeknight Pasta' }).click();
        await authenticatedPage.getByRole('button', { name: 'Shop for this week' }).click();
        await expect(authenticatedPage.getByRole('button', { name: 'Add 2 ingredients' })).toBeVisible();
        await shot(authenticatedPage, 'meal-plan-shopping-drawer');
    });
});

test.describe('Waste Warrior visual regression', () => {
    test('prompt', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Spinach Curry', [{ name: 'spinach' }]);
        await authenticatedPage.goto('/recipes/use-up');
        await expect(authenticatedPage.getByText(/Type something you don't want to waste/)).toBeVisible();
        await shot(authenticatedPage, 'waste-warrior-prompt');
    });

    test('results', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Spinach Curry', [{ name: 'spinach' }]);
        await apiCreateRecipe('Spinach Pie', [{ name: 'baby spinach' }]);
        await authenticatedPage.goto('/recipes/use-up');
        await authenticatedPage.getByPlaceholder('e.g. spinach').fill('spinach');
        await expect(authenticatedPage.getByText('Spinach Curry')).toBeVisible();
        await shot(authenticatedPage, 'waste-warrior-results');
    });
});

test.describe('Friend detail visual regression', () => {
    test('default state', async ({ authenticatedPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await authenticatedPage.goto('/friends');
        await authenticatedPage.getByText(MOCK_USER_2.username).click();
        await expect(authenticatedPage.getByRole('button', { name: 'Remove friend' })).toBeVisible();
        await shot(authenticatedPage, 'friend-detail');
    });
});

test.describe('Drawers visual regression', () => {
    test('add list', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByText('Add New List', { exact: true })).toBeVisible();
        await shot(authenticatedPage, 'drawer-add-list');
    });

    test('add item', async ({ authenticatedPage }) => {
        await apiCreateList('Groceries');
        await authenticatedPage.goto('/list/Groceries');
        await authenticatedPage.locator('button[class*="border-primary"]').first().click();
        await expect(authenticatedPage.getByText('Add New Item', { exact: true })).toBeVisible();
        await shot(authenticatedPage, 'drawer-add-item');
    });

    test('edit item', async ({ authenticatedPage, itemsPage }) => {
        await apiCreateList('Groceries');
        await apiAddItem('Groceries', 'Milk', { quantity: 2, unit: 'L' });
        await itemsPage.goto('Groceries');
        await itemsPage.swipeRight('Milk');
        await authenticatedPage.getByRole('button', { name: 'Edit Milk' }).click();
        await expect(itemsPage.editItemDrawerTitle).toBeVisible();
        await shot(authenticatedPage, 'drawer-edit-item');
    });

    test('voice add', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'milk' });
        await apiCreateList('Groceries');
        await authenticatedPage.goto('/list/Groceries');
        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add by voice' }).click();
        await expect(authenticatedPage.getByText('Tap the mic and say what you need')).toBeVisible();
        await shot(authenticatedPage, 'drawer-voice-add');
    });

    test('manage users', async ({ authenticatedPage }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await apiCreateList('Shared List', 'shopping', [MOCK_USER_2.id]);
        await authenticatedPage.goto('/list/Shared List');
        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Manage Users' }).click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
        await expect(authenticatedPage.getByText(MOCK_USER_2.username)).toBeVisible();
        await shot(authenticatedPage, 'drawer-manage-users');
    });

    test('manage labels', async ({ authenticatedPage }) => {
        await apiCreateLabel({ name: 'Home', color: '#2e7d32' });
        await authenticatedPage.clock.setFixedTime(FIXED_NOW);
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Manage Labels' }).click();
        const drawer = authenticatedPage.getByRole('dialog', { name: 'Manage Labels' });
        await expect(drawer.getByText('Home')).toBeVisible();
        await shot(authenticatedPage, 'drawer-manage-labels');
    });

    test('add todo', async ({ authenticatedPage }) => {
        await authenticatedPage.clock.setFixedTime(FIXED_NOW);
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await expect(authenticatedPage.getByRole('heading', { name: 'Add Todo' })).toBeVisible();
        await shot(authenticatedPage, 'drawer-add-todo');
    });

    test('add from recipe', async ({ authenticatedPage }) => {
        await apiCreateList('Groceries');
        await apiCreateRecipe('My Soup', [{ name: 'Carrots' }, { name: 'Onion' }]);
        await authenticatedPage.goto('/list/Groceries');
        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add from Recipe' }).click();
        await expect(authenticatedPage.getByText('My Soup')).toBeVisible();
        await shot(authenticatedPage, 'drawer-add-from-recipe');
    });
});

test.describe('Not found visual regression', () => {
    test('unknown address', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/definitely/not/a/page');
        await expect(authenticatedPage.getByText(/something went wrong|not found|404/i).first()).toBeVisible();
        await shot(authenticatedPage, 'error-unknown-route');
    });
});
