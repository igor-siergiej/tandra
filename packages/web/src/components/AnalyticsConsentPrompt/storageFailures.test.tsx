import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { AnalyticsSection } from '../../pages/SettingsPage/AnalyticsSection';
import { markConsentPromptSeen, setReplayConsent, setUsageOptedOut } from '../../utils/analyticsConsent';
import { AnalyticsConsentPrompt } from './index';

vi.mock('../../guest/GuestContext', () => ({ useGuest: () => ({ isGuest: false }) }));

vi.mock('../../utils/analytics', () => ({
    isAnalyticsConfigured: () => true,
    loadTracker: vi.fn(),
    startReplay: vi.fn(),
    stopReplay: vi.fn(),
}));

describe('privacy choices that cannot be saved', () => {
    const storage = localStorage;
    beforeEach(() => {
        storage.clear();
        vi.stubGlobal('localStorage', {
            getItem: storage.getItem.bind(storage),
            setItem: storage.setItem.bind(storage),
            removeItem: storage.removeItem.bind(storage),
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        // Successful retries clear visit-only choices between cases.
        setUsageOptedOut(false);
        setReplayConsent(false);
        markConsentPromptSeen();
        vi.unstubAllGlobals();
    });

    it.each([
        { name: 'usage opt-out', label: 'Usage statistics', key: 'umami.disabled', initial: null, checked: false },
        { name: 'usage opt-in', label: 'Usage statistics', key: 'umami.disabled', initial: 'true', checked: true },
        {
            name: 'replay opt-in',
            label: 'Help improve Tandra with session recordings',
            key: 'tandra.replayConsent',
            initial: null,
            checked: true,
        },
        {
            name: 'replay withdrawal',
            label: 'Help improve Tandra with session recordings',
            key: 'tandra.replayConsent',
            initial: 'true',
            checked: false,
        },
        {
            name: 'prompt dismissal',
            label: 'No thanks',
            key: 'tandra.analyticsPromptSeen',
            initial: null,
            checked: null,
        },
        {
            name: 'prompt acceptance',
            label: 'Allow recordings',
            key: 'tandra.analyticsPromptSeen',
            initial: null,
            checked: null,
        },
    ])(
        'warns that $name only lasts for this visit and retains it on remount',
        async ({ label, key, initial, checked }) => {
            if (initial !== null) localStorage.setItem(key, initial);
            const user = userEvent.setup();
            vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
                throw new Error('Storage full');
            });
            vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
                throw new Error('Storage unavailable');
            });
            const component = checked === null ? <AnalyticsConsentPrompt /> : <AnalyticsSection />;
            const first = render(component);

            await user.click(
                checked === null ? screen.getByRole('button', { name: label }) : screen.getByLabelText(label)
            );

            expect(screen.getByRole('alert')).toHaveTextContent(/could not save.*only.*visit/i);
            first.unmount();
            render(component);
            expect(screen.getByRole('alert')).toHaveTextContent(/could not save.*only.*visit/i);

            if (checked === null) expect(screen.queryByRole('button', { name: label })).toBeNull();
            else expect(screen.getByLabelText(label)).toHaveAttribute('aria-checked', String(checked));
        }
    );
});
