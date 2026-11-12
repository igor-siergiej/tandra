import type { Page } from '@playwright/test';

import { apiAddItem, apiCreateList, apiCreateRecipe, apiGetList } from '../api-helpers';
import { expect, test } from '../fixtures';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const shortDay = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;
const now = new Date();
const monday = addDays(now, -((now.getDay() + 6) % 7));
const rangeFor = (start: Date) => `${shortDay(start)} – ${shortDay(addDays(start, 6))}`;

const planFor = async (page: Page, weekday: string, recipeTitle: string) => {
    await page.getByRole('button', { name: `Plan a recipe for ${weekday}` }).click();
    await page.getByRole('button', { name: recipeTitle, exact: true }).click();
};

const day = (page: Page, weekday: string) => page.getByRole('region', { name: new RegExp(weekday) });

test.describe.configure({ timeout: 20000 });

test.describe('Meal plan: weeks', () => {
    test('starts on the current week and moves between weeks', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/meal-plan');
        await expect(authenticatedPage.getByRole('heading', { name: rangeFor(monday), level: 2 })).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Next week' }).click();
        await expect(
            authenticatedPage.getByRole('heading', { name: rangeFor(addDays(monday, 7)), level: 2 })
        ).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Previous week' }).click();
        await authenticatedPage.getByRole('button', { name: 'Previous week' }).click();
        await expect(
            authenticatedPage.getByRole('heading', { name: rangeFor(addDays(monday, -7)), level: 2 })
        ).toBeVisible();
    });

    test('a planned recipe stays on its own week and survives leaving and returning', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Soup', [{ name: 'leek' }], [], { servings: 2 });
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Wednesday', 'Soup');
        await expect(day(authenticatedPage, 'Wednesday').getByText('Soup')).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Next week' }).click();
        await expect(authenticatedPage.getByText('Soup')).toHaveCount(0);

        await authenticatedPage.getByRole('button', { name: 'Previous week' }).click();
        await expect(day(authenticatedPage, 'Wednesday').getByText('Soup')).toBeVisible();

        await authenticatedPage.reload();
        await expect(day(authenticatedPage, 'Wednesday').getByText('Soup')).toBeVisible();
    });

    test("today's section is marked as today and the Today jump button round-trips", async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/meal-plan');
        await expect(authenticatedPage.getByTestId('meal-plan-today-button')).toHaveCount(0);

        const todayName = now.toLocaleDateString('en-GB', { weekday: 'long' });
        const todaySection = authenticatedPage.getByRole('region', { name: new RegExp(todayName) });
        await expect(todaySection).toHaveAttribute('data-today', 'true');
        await expect(todaySection.getByTestId('meal-plan-today-badge')).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Next week' }).click();
        const todayButton = authenticatedPage.getByTestId('meal-plan-today-button');
        await expect(todayButton).toBeVisible();
        await expect(todayButton).toHaveAttribute('aria-label', 'Jump to current week');

        await todayButton.click();
        await expect(authenticatedPage.getByRole('heading', { name: rangeFor(monday), level: 2 })).toBeVisible();
        await expect(authenticatedPage.getByTestId('meal-plan-today-button')).toHaveCount(0);
    });
});

test.describe('Meal plan: empty day card', () => {
    test('each day card shows the "Nothing planned" empty state until a recipe is added', async ({
        authenticatedPage,
    }) => {
        await authenticatedPage.goto('/meal-plan');

        await expect(authenticatedPage.getByTestId('meal-plan-day-empty').first()).toBeVisible();
        await expect(authenticatedPage.getByText('Nothing planned').first()).toBeVisible();

        await apiCreateRecipe('Soup', [{ name: 'leek' }], [], { servings: 2 });
        await authenticatedPage.reload();
        await planFor(authenticatedPage, 'Monday', 'Soup');
        await expect(authenticatedPage.getByTestId('meal-plan-day-empty')).toHaveCount(6);
    });
});

test.describe('Meal plan: planning', () => {
    test('several recipes can share a day and one recipe can be planned on several days', async ({
        authenticatedPage,
    }) => {
        await apiCreateRecipe('Soup', [{ name: 'leek' }], [], { servings: 2 });
        await apiCreateRecipe('Salad', [{ name: 'lettuce' }], [], { servings: 2 });
        await authenticatedPage.goto('/meal-plan');

        await planFor(authenticatedPage, 'Monday', 'Soup');
        await expect(day(authenticatedPage, 'Monday').getByText('Soup')).toBeVisible();
        await planFor(authenticatedPage, 'Monday', 'Salad');
        await planFor(authenticatedPage, 'Thursday', 'Soup');

        await expect(day(authenticatedPage, 'Monday').getByText('Salad')).toBeVisible();
        await expect(day(authenticatedPage, 'Monday').getByText('Soup')).toBeVisible();
        await expect(day(authenticatedPage, 'Thursday').getByText('Soup')).toBeVisible();
    });

    test('portions are set per planned recipe and cannot drop below one', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Soup', [{ name: 'leek' }], [], { servings: 2 });
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Soup');
        await planFor(authenticatedPage, 'Friday', 'Soup');

        const monday = day(authenticatedPage, 'Monday');
        await monday.getByRole('button', { name: 'Increase portions' }).click();
        await expect(monday.getByTestId('portions-value')).toHaveText('3');
        await expect(day(authenticatedPage, 'Friday').getByTestId('portions-value')).toHaveText('2');

        const friday = day(authenticatedPage, 'Friday');
        await friday.getByRole('button', { name: 'Decrease portions' }).click();
        await expect(friday.getByTestId('portions-value')).toHaveText('1');
        await expect(friday.getByRole('button', { name: 'Decrease portions' })).toBeDisabled();
    });

    test('cancelling the recipe picker plans nothing', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Soup', [{ name: 'leek' }], [], { servings: 2 });
        await authenticatedPage.goto('/meal-plan');

        await authenticatedPage.getByRole('button', { name: 'Plan a recipe for Monday' }).click();
        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await expect(authenticatedPage.getByText('Soup')).toHaveCount(0);
        await expect(authenticatedPage.getByRole('button', { name: 'Shop for this week' })).toBeDisabled();
    });

    test('the picker can be searched', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Soup', [], [], { servings: 2 });
        await apiCreateRecipe('Salad', [], [], { servings: 2 });
        await authenticatedPage.goto('/meal-plan');
        await authenticatedPage.getByRole('button', { name: 'Plan a recipe for Monday' }).click();

        await authenticatedPage.getByPlaceholder('Search recipes').fill('soup');

        const list = authenticatedPage.getByRole('list', { name: 'Recipes' });
        await expect(list.getByRole('button', { name: 'Soup' })).toBeVisible();
        await expect(list.getByRole('button', { name: 'Salad' })).toHaveCount(0);
    });

    test('with no recipes the picker says so', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/meal-plan');
        await authenticatedPage.getByRole('button', { name: 'Plan a recipe for Monday' }).click();

        await expect(authenticatedPage.getByText('No recipes found.')).toBeVisible();
    });
});

test.describe('Meal plan: shopping for the week', () => {
    const shop = async (page: Page) => page.getByRole('button', { name: 'Shop for this week' }).click();

    test('the shop button is disabled until something is planned', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/meal-plan');

        await expect(authenticatedPage.getByRole('button', { name: 'Shop for this week' })).toBeDisabled();
    });

    test('ingredients can be unticked, and only the ticked ones are added', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Pasta', [{ name: 'spaghetti' }, { name: 'garlic' }, { name: 'basil' }], [], {
            servings: 2,
        });
        await apiCreateList('Weekly Shop');
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Pasta');
        await shop(authenticatedPage);

        await expect(authenticatedPage.getByRole('button', { name: 'Add 3 ingredients' })).toBeVisible();
        await authenticatedPage.getByRole('checkbox', { name: /garlic/ }).uncheck();
        await expect(authenticatedPage.getByRole('button', { name: 'Add 2 ingredients' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Add 2 ingredients' }).click();

        await expect
            .poll(async () => (await apiGetList('Weekly Shop')).items.map((i) => i.name).sort())
            .toEqual(['basil', 'spaghetti']);
    });

    test('unticking everything disables adding', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Toast', [{ name: 'bread' }], [], { servings: 2 });
        await apiCreateList('Weekly Shop');
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Toast');
        await shop(authenticatedPage);

        await authenticatedPage.getByRole('checkbox', { name: /bread/ }).uncheck();

        await expect(authenticatedPage.getByRole('button', { name: 'Add 0 ingredients' })).toBeDisabled();
    });

    test('the chosen list receives the ingredients', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Toast', [{ name: 'bread' }], [], { servings: 2 });
        await apiCreateList('Alpha');
        await apiCreateList('Beta');
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Toast');
        await shop(authenticatedPage);

        await authenticatedPage.getByLabel('Add to list').selectOption({ label: 'Beta' });
        await authenticatedPage.getByRole('button', { name: 'Add 1 ingredient' }).click();

        await expect.poll(async () => (await apiGetList('Beta')).items.map((i) => i.name)).toEqual(['bread']);
        expect((await apiGetList('Alpha')).items).toHaveLength(0);
    });

    test('the same ingredient in two planned recipes is merged into one list item', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Pasta', [{ name: 'garlic', quantity: 2, unit: 'cloves' }], [], { servings: 2 });
        await apiCreateRecipe('Bread', [{ name: 'garlic', quantity: 3, unit: 'cloves' }], [], { servings: 2 });
        await apiCreateList('Weekly Shop');
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Pasta');
        await planFor(authenticatedPage, 'Tuesday', 'Bread');
        await shop(authenticatedPage);

        await authenticatedPage.getByRole('button', { name: 'Add 2 ingredients' }).click();

        await expect(authenticatedPage.getByText(/1 items? added, 1 merged/)).toBeVisible();
        const items = (await apiGetList('Weekly Shop')).items;
        expect(items.map((i) => i.name)).toEqual(['garlic']);
        expect(items[0].quantity).toBe(5);
    });

    test('an ingredient already on the list is merged rather than duplicated', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Omelette', [{ name: 'large eggs', quantity: 2 }], [], { servings: 2 });
        await apiCreateList('Weekly Shop');
        await apiAddItem('Weekly Shop', 'eggs', { quantity: 5, unit: 'pcs' });
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Omelette');
        await shop(authenticatedPage);

        await authenticatedPage.getByRole('button', { name: 'Add 1 ingredient' }).click();

        await expect.poll(async () => (await apiGetList('Weekly Shop')).items.map((i) => i.name)).toEqual(['eggs']);
    });

    test('scaling a planned recipe scales what is added', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Rice', [{ name: 'rice', quantity: 100, unit: 'g' }], [], { servings: 2 });
        await apiCreateList('Weekly Shop');
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Rice');
        await day(authenticatedPage, 'Monday').getByRole('button', { name: 'Increase portions' }).click();
        await day(authenticatedPage, 'Monday').getByRole('button', { name: 'Increase portions' }).click();
        await shop(authenticatedPage);

        await expect(authenticatedPage.getByText('200 g')).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Add 1 ingredient' }).click();

        await expect
            .poll(async () => (await apiGetList('Weekly Shop')).items.find((i) => i.name === 'rice')?.quantity)
            .toBe(200);
    });

    test('a failed add shows the error and keeps the drawer open', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Toast', [{ name: 'bread' }], [], { servings: 2 });
        await apiCreateList('Weekly Shop');
        await authenticatedPage.route(/\/items\/bulk$/, (route) =>
            route.fulfill({ status: 500, json: { error: 'List is unavailable' } })
        );
        await authenticatedPage.goto('/meal-plan');
        await planFor(authenticatedPage, 'Monday', 'Toast');
        await shop(authenticatedPage);

        await authenticatedPage.getByRole('button', { name: 'Add 1 ingredient' }).click();

        await expect(authenticatedPage.getByRole('alert')).toContainText('List is unavailable');
        await expect(authenticatedPage.getByRole('button', { name: 'Add 1 ingredient' })).toBeVisible();
    });

    test('only the visible week is shopped for', async ({ authenticatedPage }) => {
        await apiCreateRecipe('Soup', [{ name: 'leek' }], [], { servings: 2 });
        await authenticatedPage.goto('/meal-plan');
        await authenticatedPage.getByRole('button', { name: 'Next week' }).click();
        await planFor(authenticatedPage, 'Monday', 'Soup');
        await authenticatedPage.getByRole('button', { name: 'Previous week' }).click();

        await expect(authenticatedPage.getByRole('button', { name: 'Shop for this week' })).toBeDisabled();
    });
});
