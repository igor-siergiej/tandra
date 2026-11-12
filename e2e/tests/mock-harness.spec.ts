import { apiCreateList } from '../api-helpers';
import { expect, test } from '../fixtures';
import { mockSpokenItemsParse } from '../mocks/ai';
import { installFakePush } from '../mocks/push';
import { installFakeSpeech } from '../mocks/speech';

// Exercises the shared mocks in e2e/mocks so a regression in a helper fails here, not in an unrelated feature spec.
test.describe('Shared e2e mocks', () => {
    const openVoiceDrawer = async (page: import('@playwright/test').Page, title: string) => {
        await apiCreateList(title);
        await page.goto(`/list/${title}`);
        await page.getByRole('button', { name: 'Actions' }).click();
        await page.getByRole('button', { name: 'Add by voice' }).click();
    };

    test('fake speech can report a blocked microphone', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'error', error: 'not-allowed' });
        await openVoiceDrawer(authenticatedPage, 'Mic Blocked');
        await authenticatedPage.getByRole('button', { name: 'Start listening' }).click();

        await expect(authenticatedPage.getByText(/Microphone access was blocked/)).toBeVisible();
    });

    test('a failing parse mock reaches the voice drawer', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'eggs' });
        await mockSpokenItemsParse(authenticatedPage, { status: 502, error: 'parse failed' });
        await openVoiceDrawer(authenticatedPage, 'Parse Fails');
        await authenticatedPage.getByRole('button', { name: 'Start listening' }).click();

        await expect(authenticatedPage.getByRole('list', { name: 'Items heard' })).toHaveCount(0);
    });

    test('fake push subscribes through the Notifications toggle', async ({ authenticatedPage }) => {
        await installFakePush(authenticatedPage, { permission: 'default', requestResult: 'granted' });

        const subscribed = authenticatedPage.waitForRequest(
            (req) => req.url().endsWith('/api/push/subscribe') && req.method() === 'POST'
        );

        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();
        await authenticatedPage.getByRole('button', { name: /Notifications/ }).click();

        await subscribed;
    });

    test('fake push stays unsubscribed when permission is denied', async ({ authenticatedPage }) => {
        await installFakePush(authenticatedPage, { permission: 'default', requestResult: 'denied' });
        let subscribeCalls = 0;
        authenticatedPage.on('request', (req) => {
            if (req.url().endsWith('/api/push/subscribe') && req.method() === 'POST') subscribeCalls++;
        });
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();
        await authenticatedPage.getByRole('button', { name: /Notifications/ }).click();

        await expect(
            authenticatedPage.getByRole('button', { name: /Notifications/ }).getByRole('switch')
        ).not.toBeChecked();
        expect(subscribeCalls).toBe(0);
    });
});
