import type { Page } from '@playwright/test';

import { apiCreateList, apiGetList } from '../api-helpers';
import { expect, test } from '../fixtures';
import { mockRateLimited, mockSpokenItemsParse } from '../mocks/ai';
import { installFakeSpeech } from '../mocks/speech';

const LIST_TITLE = 'Voice Edge';

const openVoiceDrawer = async (page: Page) => {
    await apiCreateList(LIST_TITLE);
    await page.goto(`/list/${LIST_TITLE}`);
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('button', { name: 'Add by voice' }).click();
};

const startListening = (page: Page) => page.getByRole('button', { name: 'Start listening' }).click();

test.describe('Voice add: microphone problems', () => {
    test('a blocked microphone explains how to fix it, and typing an item still works', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'error', error: 'not-allowed' });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByRole('alert')).toContainText('Microphone access was blocked');

        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();
        await itemsPage.addItem('Typed milk');
        await expect(itemsPage.itemRow('Typed milk')).toBeVisible();
    });

    test('no microphone found is reported', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'error', error: 'audio-capture' });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByRole('alert')).toContainText('No microphone was found');
    });

    test('hearing nothing asks the user to try again', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'error', error: 'no-speech' });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByRole('alert')).toContainText("I didn't hear anything");
    });

    test('a browser without speech recognition does not offer voice add, and typing still works', async ({
        authenticatedPage,
        itemsPage,
    }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'unsupported' });
        await apiCreateList(LIST_TITLE);
        await itemsPage.goto(LIST_TITLE);
        await itemsPage.actionsFabButton.click();

        await expect(authenticatedPage.getByRole('button', { name: 'Remove All' })).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Add by voice' })).toHaveCount(0);

        await authenticatedPage.keyboard.press('Escape');
        await itemsPage.addItem('Still typing');
        await expect(itemsPage.itemRow('Still typing')).toBeVisible();
    });
});

test.describe('Voice add: confirming what was heard', () => {
    test('unticking a heard item leaves it out', async ({ authenticatedPage, itemsPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'bread milk eggs' });
        await mockSpokenItemsParse(authenticatedPage, {
            ok: { items: [{ name: 'bread' }, { name: 'milk' }, { name: 'eggs' }] },
        });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await authenticatedPage.getByRole('checkbox').nth(1).uncheck();
        await authenticatedPage.getByRole('button', { name: 'Add 2 items' }).click();

        await expect(itemsPage.itemRow('bread')).toBeVisible();
        await expect(itemsPage.itemRow('eggs')).toBeVisible();
        await expect(itemsPage.itemRow('milk')).toHaveCount(0);
        expect((await apiGetList(LIST_TITLE)).items.map((i) => i.name).sort()).toEqual(['bread', 'eggs']);
    });

    test('unticking everything disables the add button', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'bread' });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [{ name: 'bread' }] } });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await authenticatedPage.getByRole('checkbox').uncheck();

        await expect(authenticatedPage.getByRole('button', { name: 'Add 0 items' })).toBeDisabled();
    });

    test('cancelling after parsing adds nothing', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'bread' });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [{ name: 'bread' }] } });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);
        await expect(authenticatedPage.getByRole('list', { name: 'Items heard' })).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await expect(authenticatedPage.getByRole('list', { name: 'Items heard' })).toHaveCount(0);
        expect((await apiGetList(LIST_TITLE)).items).toHaveLength(0);
    });

    test('the drawer starts clean after being dismissed', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'bread' });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [{ name: 'bread' }] } });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);
        await expect(authenticatedPage.getByRole('list', { name: 'Items heard' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Cancel' }).click();

        await authenticatedPage.getByRole('button', { name: 'Actions' }).click();
        await authenticatedPage.getByRole('button', { name: 'Add by voice' }).click();

        await expect(authenticatedPage.getByText('Tap the mic and say what you need')).toBeVisible();
    });

    test('"Say it again" returns to listening without adding anything', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'sessions', transcripts: ['bread', 'milk'] });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [{ name: 'bread' }] } });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);
        await expect(authenticatedPage.getByRole('list', { name: 'Items heard' })).toBeVisible();

        await authenticatedPage.getByRole('button', { name: 'Say it again' }).click();

        await expect(authenticatedPage.getByRole('list', { name: 'Items heard' })).toHaveCount(0);
        expect((await apiGetList(LIST_TITLE)).items).toHaveLength(0);
    });
});

test.describe('Voice add: parse failures', () => {
    test('a parser failure shows an error and keeps the transcript', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'two loaves of bread' });
        await mockSpokenItemsParse(authenticatedPage, { status: 502, error: 'Could not understand that' });
        let parseRequests = 0;
        authenticatedPage.on('request', (req) => {
            if (req.url().endsWith('/api/items/parse')) parseRequests++;
        });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByRole('alert')).toContainText('Could not understand that');
        await expect(authenticatedPage.getByText('two loaves of bread')).toBeVisible();
        // A failed parse must not be retried in a loop: each retry spends the user's AI quota.
        await authenticatedPage.waitForTimeout(500);
        expect(parseRequests).toBe(1);
    });

    test('an empty parse result says nothing was found', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'um' });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [] } });
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByRole('alert')).toContainText("couldn't find any items");
    });

    test('hitting the AI rate limit shows the limit message', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'transcript', transcript: 'bread' });
        await mockRateLimited(authenticatedPage, '**/api/items/parse');
        await openVoiceDrawer(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByRole('alert')).toContainText('Too many AI requests');
    });
});

test.describe('Voice add: keep listening', () => {
    const transcriptSentToParser = (page: Page) =>
        page
            .waitForRequest((req) => req.url().endsWith('/api/items/parse'))
            .then((req) => req.postDataJSON().transcript);

    test('with keep-listening on, a pause does not end the session; tapping stop does', async ({
        authenticatedPage,
    }) => {
        await authenticatedPage.addInitScript(() => localStorage.setItem('tandra.voiceKeepListening', 'true'));
        await installFakeSpeech(authenticatedPage, { kind: 'sessions', transcripts: ['milk', 'and eggs'] });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [{ name: 'milk' }, { name: 'eggs' }] } });
        await openVoiceDrawer(authenticatedPage);
        const parsed = transcriptSentToParser(authenticatedPage);
        await startListening(authenticatedPage);

        await expect(authenticatedPage.getByText('milk and eggs')).toBeVisible();
        await expect(authenticatedPage.getByRole('button', { name: 'Stop listening' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Stop listening' }).click();

        expect(await parsed).toBe('milk and eggs');
    });

    test('with keep-listening off, the first pause ends the session', async ({ authenticatedPage }) => {
        await installFakeSpeech(authenticatedPage, { kind: 'sessions', transcripts: ['milk', 'and eggs'] });
        await mockSpokenItemsParse(authenticatedPage, { ok: { items: [{ name: 'milk' }] } });
        await openVoiceDrawer(authenticatedPage);
        const parsed = transcriptSentToParser(authenticatedPage);
        await startListening(authenticatedPage);

        expect(await parsed).toBe('milk');
    });
});
