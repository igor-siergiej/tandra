import { expect, test } from '../fixtures';

test('@smoke the public privacy notice documents analytics storage choices', async ({ page }) => {
    await page.goto('https://tandra.uk/privacy/');

    const storageTable = page
        .getByRole('table')
        .filter({ has: page.getByRole('rowheader', { name: 'umami.disabled', exact: true }) });

    for (const [key, purpose] of [
        ['umami.disabled', /usage statistics/i],
        ['tandra.replayConsent', /session (recordings|replay)/i],
        ['tandra.analyticsPromptSeen', /first-run analytics prompt/i],
    ] as const) {
        const row = storageTable
            .getByRole('row')
            .filter({ has: page.getByRole('rowheader', { name: key, exact: true }) });

        await expect(row.getByRole('cell').nth(0)).toHaveText('localStorage');
        await expect(row.getByRole('cell').nth(1)).toContainText(purpose);
        await expect(row.getByRole('cell').nth(2)).toContainText(/until cleared by the user/i);
    }
});
