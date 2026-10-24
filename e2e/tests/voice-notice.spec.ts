import type { Page } from '@playwright/test';
import { apiCreateList } from '../api-helpers';
import { expect, test } from '../fixtures';
import { mockSpokenItemsParse } from '../mocks/ai';
import { installFakeSpeech } from '../mocks/speech';

const LIST_TITLE = 'Voice Notice';

const openVoiceDrawer = async (page: Page) => {
    await page.goto(`/list/${LIST_TITLE}`);
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('button', { name: 'Add by voice' }).click();
};

const speechStarts = (page: Page) =>
    page.evaluate(() => (window as unknown as { __speechStarts?: number }).__speechStarts ?? 0);

test.describe('Voice add: one-time notice', () => {
    test('explains where speech goes before the mic first opens, and only once', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        await installFakeSpeech(page, { kind: 'transcript', transcript: 'milk' }, { showNotice: true });
        await mockSpokenItemsParse(page, { ok: { items: [{ name: 'milk' }] } });
        await apiCreateList(LIST_TITLE);
        await openVoiceDrawer(page);

        await page.getByRole('button', { name: 'Start listening' }).click();

        await expect(page.getByRole('heading', { name: 'Before you speak' })).toBeVisible();
        await expect(page.getByText(/browser's speech service/)).toBeVisible();
        await expect(page.getByText(/sent to fal\.ai/)).toBeVisible();
        await expect(page.getByRole('link', { name: 'Read the privacy policy' })).toHaveAttribute(
            'href',
            'https://tandra.uk/privacy'
        );
        expect(await speechStarts(page)).toBe(0);

        await page.getByRole('button', { name: 'Got it' }).click();

        await expect(page.getByRole('list', { name: 'Items heard' })).toBeVisible();
        expect(await speechStarts(page)).toBe(1);
        expect(await page.evaluate(() => localStorage.getItem('tandra.voiceAck'))).toBe('true');

        await page.getByRole('button', { name: 'Cancel' }).click();
        await page.reload();
        await page.getByRole('button', { name: 'Actions' }).click();
        await page.getByRole('button', { name: 'Add by voice' }).click();
        await page.getByRole('button', { name: 'Start listening' }).click();

        await expect(page.getByRole('list', { name: 'Items heard' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Got it' })).toHaveCount(0);
    });

    test('clearing site storage brings the notice back', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        await installFakeSpeech(page, { kind: 'transcript', transcript: 'milk' }, { showNotice: true });
        await apiCreateList(LIST_TITLE);
        await openVoiceDrawer(page);
        await page.getByRole('button', { name: 'Start listening' }).click();
        await page.getByRole('button', { name: 'Got it' }).click();
        await page.getByRole('button', { name: 'Cancel' }).click();

        await page.evaluate(() => localStorage.clear());
        await openVoiceDrawer(page);
        await page.getByRole('button', { name: 'Start listening' }).click();

        await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
        expect(await speechStarts(page)).toBe(0);
    });
});
