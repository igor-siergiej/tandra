import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type * as AnalyticsModule from '../../utils/analytics';
import { AnalyticsConsentPrompt } from './index';

const mocks = vi.hoisted(() => ({ isGuest: false, configured: true, startReplay: vi.fn() }));

vi.mock('../../guest/GuestContext', () => ({ useGuest: () => ({ isGuest: mocks.isGuest }) }));

vi.mock('../../utils/analytics', async (importOriginal) => ({
    ...(await importOriginal<typeof AnalyticsModule>()),
    isAnalyticsConfigured: () => mocks.configured,
    startReplay: mocks.startReplay,
}));

const allow = () => screen.getByRole('button', { name: 'Allow recordings' });
const decline = () => screen.getByRole('button', { name: 'No thanks' });

describe('AnalyticsConsentPrompt', () => {
    beforeEach(() => {
        localStorage.clear();
        mocks.isGuest = false;
        mocks.configured = true;
        mocks.startReplay.mockClear();
    });

    it('declining hides it for good without consenting', async () => {
        const user = userEvent.setup();
        const first = render(<AnalyticsConsentPrompt />);

        await user.click(decline());
        expect(screen.queryByText(/session recordings/i)).toBeNull();
        first.unmount();
        render(<AnalyticsConsentPrompt />);

        expect(screen.queryByText(/session recordings/i)).toBeNull();
        expect(localStorage.getItem('tandra.replayConsent')).toBeNull();
        expect(mocks.startReplay).not.toHaveBeenCalled();
    });

    it('allowing saves consent, starts replay and hides it', async () => {
        const user = userEvent.setup();
        render(<AnalyticsConsentPrompt />);

        await user.click(allow());

        expect(localStorage.getItem('tandra.replayConsent')).toBe('true');
        expect(mocks.startReplay).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/session recordings/i)).toBeNull();
    });

    it.each([
        ['a guest', () => (mocks.isGuest = true)],
        ['analytics is not configured', () => (mocks.configured = false)],
        ['the visitor opted out of usage statistics', () => localStorage.setItem('umami.disabled', 'true')],
        ['the prompt was already answered', () => localStorage.setItem('tandra.analyticsPromptSeen', 'true')],
    ])('stays hidden when %s', (_name, arrange) => {
        arrange();
        render(<AnalyticsConsentPrompt />);

        expect(screen.queryByText(/session recordings/i)).toBeNull();
    });
});
