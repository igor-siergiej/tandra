import { apiCreateLabel, apiCreateTodo } from '../api-helpers';
import { seedFriendship } from '../db-helpers';
import { expect, test } from '../fixtures';
import { MOCK_USER, MOCK_USER_2 } from '../mocks/data/users';

function isoDay(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
}

const today = new Date();
const todayKey = isoDay(today);
const tomorrowKey = isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));

test.describe('Calendar page', () => {
    test('nav: bottom-bar Calendar button routes to /calendar', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Calendar' }).click();
        await authenticatedPage.waitForURL('/calendar');
        await expect(authenticatedPage.getByTestId('add-todo-trigger')).toBeVisible();
    });

    test('create dated todo via UI appears in day list', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('UI Created Todo');
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        // Today is pre-selected; the drawer prefills due date to today
        await expect(authenticatedPage.getByText('UI Created Todo')).toBeVisible();
    });

    test('inbox: undated todo appears in inbox after clearing due date', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Inbox Todo');

        // Clear the pre-filled due date so the todo lands in inbox
        await authenticatedPage.getByRole('button', { name: 'Clear due date' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        // Open inbox
        await authenticatedPage.getByTestId('inbox-toggle').click();
        await expect(authenticatedPage.getByText('Inbox Todo')).toBeVisible();
    });

    test('inbox drag-to-day: seeded undated todo can be dragged onto today', async ({ authenticatedPage }) => {
        const todo = await apiCreateTodo({ title: 'Drag Me' });

        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId('inbox-toggle').click();
        const inboxItem = authenticatedPage.getByTestId(`inbox-item-${todo.id}`);
        await expect(inboxItem).toBeVisible();

        const dayCell = authenticatedPage.getByTestId(`day-${todayKey}`);
        await inboxItem.dragTo(dayCell);

        // After drop the todo should now appear in today's day list (it gains dueDate=today)
        await expect(authenticatedPage.getByText('Drag Me')).toBeVisible();
    });

    // HTML5 drag-and-drop (used above) doesn't fire on touch devices, so tap-to-schedule
    // is the reliable path on mobile: tap the inbox row, then tap a day to assign it.
    test('inbox tap-to-schedule: undated todo can be scheduled onto a day by tapping', async ({
        authenticatedPage,
    }) => {
        const todo = await apiCreateTodo({ title: 'Tap To Schedule Me' });

        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId('inbox-toggle').click();
        await authenticatedPage.getByTestId(`inbox-item-schedule-${todo.id}`).click();

        // Drawer auto-collapses and the day grid becomes tappable.
        await expect(authenticatedPage.getByText('Tap a day to schedule it')).toBeVisible();
        await authenticatedPage.getByTestId(`day-${tomorrowKey}`).click();

        await expect(authenticatedPage.getByText('Tap a day to schedule it')).not.toBeVisible();
        await authenticatedPage.getByTestId(`day-${tomorrowKey}`).click();
        await expect(authenticatedPage.getByText('Tap To Schedule Me')).toBeVisible();
    });

    test('inbox tap-to-schedule: works from week view too', async ({ authenticatedPage }) => {
        const todo = await apiCreateTodo({ title: 'Week Schedule Me' });

        await authenticatedPage.goto('/calendar');
        await authenticatedPage.getByRole('combobox').filter({ hasText: 'Month' }).click();
        await authenticatedPage.getByRole('option', { name: 'Week' }).click();

        await authenticatedPage.getByTestId('inbox-toggle').click();
        await authenticatedPage.getByTestId(`inbox-item-schedule-${todo.id}`).click();

        await authenticatedPage.getByTestId(`week-day-${todayKey}`).click();

        await expect(authenticatedPage.getByText('Week Schedule Me')).toBeVisible();
    });

    test('complete single todo: checkbox draws the strike', async ({ authenticatedPage }) => {
        await apiCreateTodo({ title: 'Completable Task', dueDate: todayKey });

        await authenticatedPage.goto('/calendar');

        await expect(authenticatedPage.getByText('Completable Task')).toBeVisible();

        // Click the checkbox for this item
        const listItem = authenticatedPage.locator('li').filter({ hasText: 'Completable Task' });
        await listItem.getByRole('checkbox').click();

        await expect(listItem.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'true');
    });

    test('recurring isolation: completing today does not mark tomorrow', async ({ authenticatedPage }) => {
        // Create a daily recurring todo via UI
        await authenticatedPage.goto('/calendar');

        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Daily Recur');

        // Set recurrence to Daily
        await authenticatedPage.getByRole('combobox').filter({ hasText: 'Does not repeat' }).click();
        await authenticatedPage.getByRole('option', { name: 'Daily' }).click();

        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        // Complete today's occurrence
        const todayItem = authenticatedPage.locator('li').filter({ hasText: 'Daily Recur' });
        await todayItem.getByRole('checkbox').click();
        await expect(todayItem.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'true');

        // Navigate to tomorrow's cell
        await authenticatedPage.getByTestId(`day-${tomorrowKey}`).click();

        // Tomorrow's occurrence should exist but NOT be done
        const tomorrowItem = authenticatedPage.locator('li').filter({ hasText: 'Daily Recur' });
        await expect(tomorrowItem).toBeVisible();
        await expect(tomorrowItem.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'false');
    });

    test('labels: filter chip dims non-matching todos and keeps matches visible', async ({ authenticatedPage }) => {
        // Seed the label, then assign it through the add-todo drawer dropdown.
        await apiCreateLabel({ name: 'Work', color: '#ff0000' });

        await authenticatedPage.goto('/calendar');

        // Labelled todo (due date prefills to the selected day = today).
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Work Todo');
        await authenticatedPage.getByRole('combobox').filter({ hasText: 'No label' }).click();
        await authenticatedPage.getByRole('option', { name: 'Work' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        // Unlabelled todo.
        await authenticatedPage.getByTestId('add-todo-trigger').click();
        await authenticatedPage.getByLabel('Title').fill('Plain Todo');
        await authenticatedPage.getByRole('button', { name: 'Add Todo' }).click();

        await expect(authenticatedPage.getByText('Work Todo')).toBeVisible();
        await expect(authenticatedPage.getByText('Plain Todo')).toBeVisible();

        // Activate the label filter chip.
        await authenticatedPage.getByRole('button', { name: 'Work', exact: true }).click();

        // Both stay visible; only the non-matching todo is dimmed.
        await expect(authenticatedPage.getByText('Work Todo')).toBeVisible();
        await expect(authenticatedPage.getByText('Plain Todo')).toBeVisible();
        await expect(authenticatedPage.locator('li[data-todo-title="Plain Todo"] .opacity-40')).toBeVisible();
        await expect(authenticatedPage.locator('li[data-todo-title="Work Todo"] .opacity-40')).toHaveCount(0);

        // Month-grid dots for today: two dots, exactly one dimmed.
        const todayCell = authenticatedPage.getByTestId(`day-${todayKey}`);
        await expect(todayCell.getByTestId('day-dot')).toHaveCount(2);
        await expect(todayCell.locator('[data-testid="day-dot"][data-dimmed="true"]')).toHaveCount(1);
        await expect(todayCell.locator('[data-testid="day-dot"][data-dimmed="false"]')).toHaveCount(1);
    });

    test('manage sharing: owner can share an existing todo with a friend after creation', async ({
        authenticatedPage,
    }) => {
        // Todo created before the friendship exists, so it starts genuinely unshared
        // (mirrors createTodo's friend-seeding: no friends yet means no default share).
        await apiCreateTodo({ title: 'Unshared Todo', dueDate: todayKey });
        await seedFriendship(MOCK_USER, MOCK_USER_2);

        await authenticatedPage.goto('/calendar');
        const row = authenticatedPage.locator('li[data-todo-title="Unshared Todo"]');
        await expect(row).toBeVisible();

        const shareButton = row.getByLabel('Manage sharing for Unshared Todo');
        await expect(shareButton).toBeVisible();
        await shareButton.click();

        await expect(authenticatedPage.getByRole('heading', { name: 'Manage Sharing' })).toBeVisible();
        await expect(authenticatedPage.getByRole('switch')).not.toBeChecked();
        await authenticatedPage.getByRole('switch').click();
        await expect(authenticatedPage.getByRole('switch')).toBeChecked();

        await authenticatedPage.getByRole('button', { name: 'Close' }).click();

        // Reopening confirms the share persisted.
        await shareButton.click();
        await expect(authenticatedPage.getByRole('switch')).toBeChecked();
    });

    // Week view rather than month view: no month grid to navigate, so the swipe target's
    // position doesn't depend on how many rows the real calendar date happens to need.
    const switchToWeekView = async (page: import('@playwright/test').Page) => {
        await page.getByRole('combobox').filter({ hasText: 'Month' }).click();
        await page.getByRole('option', { name: 'Week' }).click();
    };

    test('swipe left past threshold deletes a todo', async ({ authenticatedPage }) => {
        await apiCreateTodo({ title: 'Swipe Delete Me', dueDate: todayKey });

        await authenticatedPage.goto('/calendar');
        await switchToWeekView(authenticatedPage);
        const row = authenticatedPage.locator('li[data-todo-title="Swipe Delete Me"]');
        await expect(row).toBeVisible();

        const box = await row.boundingBox();

        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await authenticatedPage.mouse.move(cx, cy);
            await authenticatedPage.mouse.down();
            await authenticatedPage.mouse.move(cx - 100, cy, { steps: 10 });
            await authenticatedPage.mouse.up();
        }

        await expect(authenticatedPage.getByText('Swipe Delete Me')).not.toBeVisible();
    });

    test('deleting a recurring todo removes all future occurrences', async ({ authenticatedPage }) => {
        await apiCreateTodo({
            title: 'Recurring To Delete',
            dueDate: todayKey,
            recurrence: { freq: 'daily', interval: 1 },
        });

        await authenticatedPage.goto('/calendar');
        await switchToWeekView(authenticatedPage);
        // Week view expands the recurring todo into one row per day — swiping any single
        // occurrence deletes the underlying todo (and so every occurrence) in one call.
        const row = authenticatedPage.locator('li[data-todo-title="Recurring To Delete"]').first();
        await expect(row).toBeVisible();

        const box = await row.boundingBox();

        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await authenticatedPage.mouse.move(cx, cy);
            await authenticatedPage.mouse.down();
            await authenticatedPage.mouse.move(cx - 100, cy, { steps: 10 });
            await authenticatedPage.mouse.up();
        }

        // Week view lists every day at once, so this also confirms tomorrow's occurrence
        // is gone — the whole recurring todo was deleted, not just today's instance.
        await expect(authenticatedPage.getByText('Recurring To Delete')).toHaveCount(0);
    });
});
