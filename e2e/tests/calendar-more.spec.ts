import type { Page } from '@playwright/test';

import { apiCreateTodo, apiCreateTodoAsOtherUser, apiGetTodos, apiGetTodosAsOtherUser } from '../api-helpers';
import { seedFriendship } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';

const isoDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const now = new Date();
const todayKey = isoDay(now);
const midMonth = new Date(now.getFullYear(), now.getMonth(), 15);
const midMonthKey = isoDay(midMonth);
const monthLabel = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const switchView = async (page: Page, from: 'Month' | 'Week', to: 'Month' | 'Week') => {
    await page.getByRole('combobox').filter({ hasText: from }).click();
    await page.getByRole('option', { name: to }).click();
};

const monthNav = (page: Page, label: string) =>
    page.getByText(label, { exact: true }).locator('..').getByRole('button');

test.describe('Calendar: views and navigation', () => {
    test('switching to week view lists upcoming todos by day, and back to month restores the grid', async ({
        authenticatedPage,
    }) => {
        await apiCreateTodo({ title: 'Today Task', dueDate: todayKey });
        await apiCreateTodo({ title: 'Later Task', dueDate: isoDay(addDays(now, 3)) });
        await authenticatedPage.goto('/calendar');
        await expect(authenticatedPage.getByTestId(`day-${todayKey}`)).toBeVisible();

        await switchView(authenticatedPage, 'Month', 'Week');

        await expect(authenticatedPage.getByText('Today Task')).toBeVisible();
        await expect(authenticatedPage.getByText('Later Task')).toBeVisible();
        await expect(authenticatedPage.getByTestId(`day-${todayKey}`)).toHaveCount(0);

        await switchView(authenticatedPage, 'Week', 'Month');
        await expect(authenticatedPage.getByTestId(`day-${todayKey}`)).toBeVisible();
    });

    test('week view with nothing due says so', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');

        await switchView(authenticatedPage, 'Month', 'Week');

        await expect(authenticatedPage.getByText('No upcoming todos this week')).toBeVisible();
    });

    test('the month can be moved forward and back', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await expect(authenticatedPage.getByText(monthLabel(now), { exact: true })).toBeVisible();

        await monthNav(authenticatedPage, monthLabel(now)).last().click();
        await expect(authenticatedPage.getByText(monthLabel(nextMonth), { exact: true })).toBeVisible();
        await expect(
            authenticatedPage.getByTestId(`day-${isoDay(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 10))}`)
        ).toBeVisible();

        await monthNav(authenticatedPage, monthLabel(nextMonth)).first().click();
        await expect(authenticatedPage.getByText(monthLabel(now), { exact: true })).toBeVisible();
    });

    test("selecting a day shows that day's todos and an empty day says so", async ({ authenticatedPage }) => {
        await apiCreateTodo({ title: 'Mid Month Task', dueDate: midMonthKey });
        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId(`day-${midMonthKey}`).click();
        await expect(authenticatedPage.getByText('Mid Month Task')).toBeVisible();

        const empty = new Date(now.getFullYear(), now.getMonth(), 20);
        await authenticatedPage.getByTestId(`day-${isoDay(empty)}`).click();
        await expect(authenticatedPage.getByText('No todos for this day')).toBeVisible();
        await expect(authenticatedPage.getByText('Mid Month Task')).toHaveCount(0);
    });

    test('a day with many todos lists all of them', async ({ authenticatedPage }) => {
        for (let n = 1; n <= 10; n++) {
            await apiCreateTodo({ title: `Bulk ${String(n).padStart(2, '0')}`, dueDate: midMonthKey });
        }

        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId(`day-${midMonthKey}`).click();

        await expect(authenticatedPage.locator('li[data-todo-title^="Bulk "]')).toHaveCount(10);
    });
});

test.describe('Calendar: times', () => {
    test('each todo shows its time', async ({ authenticatedPage }) => {
        await apiCreateTodo({ title: 'Afternoon', dueDate: midMonthKey, time: '15:30' });
        await apiCreateTodo({ title: 'Morning', dueDate: midMonthKey, time: '08:15' });
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId(`day-${midMonthKey}`).click();

        await expect(authenticatedPage.locator('li[data-todo-title="Morning"]')).toContainText('08:15');
        await expect(authenticatedPage.locator('li[data-todo-title="Afternoon"]')).toContainText('15:30');
    });

    test('a time set while creating a todo is saved with it', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Timed Todo');
        await authenticatedPage.getByLabel('Time (Optional)').fill('09:45');
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        await expect(authenticatedPage.getByText('Timed Todo')).toBeVisible();
        await expect.poll(async () => (await apiGetTodos()).find((t) => t.title === 'Timed Todo')?.time).toBe('09:45');
        await expect(authenticatedPage.locator('li[data-todo-title="Timed Todo"]')).toContainText('09:45');
    });
});

test.describe('Calendar: creating todos', () => {
    test('a todo needs a title', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();

        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        await expect(authenticatedPage.getByText('Title is required')).toBeVisible();
        expect(await apiGetTodos()).toHaveLength(0);
    });

    test('a natural-language date such as "tomorrow" sets the due date', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Soon');

        await authenticatedPage.getByRole('button', { name: /^\d\d\/\d\d\/\d{4}$/ }).click();
        await authenticatedPage.getByLabel('Natural language date').fill('tomorrow');
        await expect(authenticatedPage.getByTestId('nl-date-preview')).toContainText('→');
        await authenticatedPage.getByLabel('Natural language date').press('Enter');
        await authenticatedPage.keyboard.press('Escape');
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        await expect
            .poll(async () => (await apiGetTodos()).find((t) => t.title === 'Soon')?.dueDate)
            .toBe(isoDay(addDays(now, 1)));
    });

    test('an unrecognised natural-language date is flagged', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();

        await authenticatedPage.getByRole('button', { name: /^\d\d\/\d\d\/\d{4}$/ }).click();
        await authenticatedPage.getByLabel('Natural language date').fill('blorpday');

        await expect(authenticatedPage.getByTestId('nl-date-preview')).toHaveText('Unrecognized date');
    });

    test('cancelling the drawer discards the todo', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Never saved');

        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await expect(authenticatedPage.getByText('Never saved')).toHaveCount(0);
        expect(await apiGetTodos()).toHaveLength(0);
    });
});

test.describe('Calendar: recurrence', () => {
    test('a daily todo created from the drawer repeats on every upcoming day', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Daily Habit');
        await authenticatedPage.getByRole('combobox').filter({ hasText: 'Does not repeat' }).click();
        await authenticatedPage.getByRole('option', { name: 'Daily' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();
        await expect
            .poll(async () => (await apiGetTodos()).find((t) => t.title === 'Daily Habit')?.recurrence)
            .toEqual({
                freq: 'daily',
                interval: 1,
            });

        await switchView(authenticatedPage, 'Month', 'Week');

        await expect(authenticatedPage.locator('li[data-todo-title="Daily Habit"]')).toHaveCount(7);
    });

    test('an interval of two skips alternate days', async ({ authenticatedPage }) => {
        await apiCreateTodo({
            title: 'Every Other Day',
            dueDate: todayKey,
            recurrence: { freq: 'daily', interval: 2 },
        });
        await authenticatedPage.goto('/calendar');

        await switchView(authenticatedPage, 'Month', 'Week');

        await expect(authenticatedPage.locator('li[data-todo-title="Every Other Day"]')).toHaveCount(4);
    });

    test('a recurrence stops after its end date', async ({ authenticatedPage }) => {
        await apiCreateTodo({
            title: 'Short Run',
            dueDate: todayKey,
            recurrence: { freq: 'daily', interval: 1, until: isoDay(addDays(now, 2)) },
        });
        await authenticatedPage.goto('/calendar');

        await switchView(authenticatedPage, 'Month', 'Week');

        await expect(authenticatedPage.locator('li[data-todo-title="Short Run"]')).toHaveCount(3);
    });

    test('a weekly todo shows once in the coming week, not every day', async ({ authenticatedPage }) => {
        await apiCreateTodo({ title: 'Weekly Review', dueDate: todayKey, recurrence: { freq: 'weekly', interval: 1 } });
        await authenticatedPage.goto('/calendar');

        await switchView(authenticatedPage, 'Month', 'Week');

        await expect(authenticatedPage.locator('li[data-todo-title="Weekly Review"]')).toHaveCount(1);
    });
});

test.describe('Calendar: todos shared with me', () => {
    test('appear on my calendar; I can tick them off but cannot manage sharing or delete them', async ({
        authenticatedPage,
    }) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await apiCreateTodoAsOtherUser({ title: 'Their Todo', dueDate: todayKey }, [MOCK_USER.id]);
        await authenticatedPage.goto('/calendar');
        await switchView(authenticatedPage, 'Month', 'Week');
        const row = authenticatedPage.locator('li[data-todo-title="Their Todo"]');
        await expect(row).toBeVisible();

        await expect(row.getByLabel('Manage sharing for Their Todo')).toHaveCount(0);

        await row.getByRole('checkbox').click();
        await expect(row.getByRole('checkbox')).toBeChecked();

        const box = await row.boundingBox();

        if (!box) throw new Error('row not found');
        await authenticatedPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await authenticatedPage.mouse.down();
        await authenticatedPage.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 10 });
        await authenticatedPage.mouse.up();

        await authenticatedPage.reload();
        await expect(authenticatedPage.getByText('Their Todo')).toBeVisible();
    });
});

test.describe('Calendar: sharing a new todo', () => {
    const addTodo = async (page: Page, title: string, shareWithFriend: boolean) => {
        await seedFriendship(MOCK_USER, MOCK_USER_2);
        await page.goto('/calendar');
        await page.getByTestId('add-todo-trigger').click();
        await page.getByLabel('Title').fill(title);
        const friendSwitch = page.getByRole('switch');
        // New todos start private: no friend is switched on until the user picks one.
        await expect(friendSwitch).not.toBeChecked();

        if (shareWithFriend) await friendSwitch.click();
        await page.getByRole('button', { name: 'Add Todo' }).click();
        await expect.poll(async () => (await apiGetTodos()).some((t) => t.title === title)).toBe(true);
    };

    test('with the picker left untouched, the todo stays private', async ({ authenticatedPage }) => {
        await addTodo(authenticatedPage, 'Private Todo', false);
        expect((await apiGetTodosAsOtherUser()).map((t) => t.title)).not.toContain('Private Todo');
    });

    test('with a friend switched on, the todo is shared with them', async ({ authenticatedPage }) => {
        await addTodo(authenticatedPage, 'Shared Todo', true);
        expect((await apiGetTodosAsOtherUser()).map((t) => t.title)).toContain('Shared Todo');
    });
});
