import { apiCreateLabel } from '../api-helpers';
import { expect, test } from '../fixtures';

const openManageLabels = async (page: import('@playwright/test').Page) => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('button', { name: 'Manage Labels' }).click();
    // Scope all further queries to the drawer — the calendar's label-filter chips behind
    // it can render the same label text and would otherwise cause strict-mode ambiguity.
    const drawer = page.getByRole('dialog', { name: 'Manage Labels' });
    await expect(drawer.getByRole('heading', { name: 'Manage Labels' })).toBeVisible();

    return drawer;
};

test.describe('Manage Labels', () => {
    test('shows empty state with no labels', async ({ authenticatedPage }) => {
        const drawer = await openManageLabels(authenticatedPage);
        await expect(drawer.getByText('No labels yet')).toBeVisible();
    });

    test('can create a label', async ({ authenticatedPage }) => {
        const drawer = await openManageLabels(authenticatedPage);

        await drawer.getByPlaceholder('Label name').fill('Groceries');
        await drawer.getByRole('button', { name: 'Add' }).click();

        await expect(drawer.getByText('Groceries')).toBeVisible();
        await expect(drawer.getByPlaceholder('Label name')).toHaveValue('');
    });

    test('Add is disabled until a name is entered', async ({ authenticatedPage }) => {
        const drawer = await openManageLabels(authenticatedPage);
        await expect(drawer.getByRole('button', { name: 'Add' })).toBeDisabled();

        await drawer.getByPlaceholder('Label name').fill('Work');
        await expect(drawer.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    test('can delete a label', async ({ authenticatedPage }) => {
        await apiCreateLabel({ name: 'Chores', color: '#ff0000' });

        const drawer = await openManageLabels(authenticatedPage);
        await expect(drawer.getByText('Chores')).toBeVisible();

        await drawer.locator('div.rounded-lg.bg-muted\\/40', { hasText: 'Chores' }).getByRole('button').click();

        await expect(drawer.getByText('Chores')).not.toBeVisible();
        await expect(drawer.getByText('No labels yet')).toBeVisible();
    });
});
