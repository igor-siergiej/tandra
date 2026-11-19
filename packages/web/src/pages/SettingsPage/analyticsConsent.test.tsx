import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { UnitSystemProvider } from '../../contexts/UnitSystemContext';
import type * as AnalyticsModule from '../../utils/analytics';
import SettingsPage from './index';

const analytics = vi.hoisted(() => ({ startReplay: vi.fn(), stopReplay: vi.fn() }));

vi.mock('../../utils/analytics', async (importOriginal) => ({
    ...(await importOriginal<typeof AnalyticsModule>()),
    startReplay: analytics.startReplay,
    stopReplay: analytics.stopReplay,
}));

vi.mock('./AccountSection', () => ({ AccountSection: () => <section>Account section</section> }));

const renderPage = () =>
    render(
        <MemoryRouter>
            <UnitSystemProvider>
                <SettingsPage />
            </UnitSystemProvider>
        </MemoryRouter>
    );

const usageToggle = () => screen.getByLabelText(/Usage statistics/i);
const recordingsToggle = () => screen.getByLabelText(/Help improve Tandra with session recordings/i);

describe('Settings analytics controls', () => {
    beforeEach(() => {
        localStorage.clear();
        analytics.startReplay.mockClear();
        analytics.stopReplay.mockClear();
    });

    it('defaults match the notice: Usage statistics ON, session recordings OFF', () => {
        renderPage();

        expect(usageToggle()).toBeChecked();
        expect(recordingsToggle()).not.toBeChecked();
        expect(localStorage.getItem('umami.disabled')).toBeNull();
    });

    it('turning Usage statistics OFF sets umami.disabled to "true"; turning it ON again clears the key', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(usageToggle());
        expect(usageToggle()).not.toBeChecked();
        expect(localStorage.getItem('umami.disabled')).toBe('true');

        await user.click(usageToggle());
        expect(usageToggle()).toBeChecked();
        // Umami and the analytics module treat any stored value, "false" included, as opted out.
        expect(localStorage.getItem('umami.disabled')).toBeNull();
    });

    it('shows Usage statistics OFF when the visitor already opted out, whichever truthy value Umami left', () => {
        localStorage.setItem('umami.disabled', '1');
        renderPage();

        expect(usageToggle()).not.toBeChecked();
    });

    it('turning session recordings ON starts session replay', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(recordingsToggle());

        expect(recordingsToggle()).toBeChecked();
        expect(analytics.startReplay).toHaveBeenCalledTimes(1);
    });

    it('toggling Usage statistics does not start session replay', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(usageToggle());

        expect(analytics.startReplay).not.toHaveBeenCalled();
    });

    it('both choices survive a refresh', async () => {
        const user = userEvent.setup();
        const first = renderPage();
        await user.click(usageToggle());
        await user.click(recordingsToggle());
        first.unmount();

        renderPage();

        expect(usageToggle()).not.toBeChecked();
        expect(recordingsToggle()).toBeChecked();
    });

    it('a recordings choice made earlier stays ON after a refresh even while Usage statistics stays ON', async () => {
        const user = userEvent.setup();
        const first = renderPage();
        await user.click(recordingsToggle());
        first.unmount();

        renderPage();

        expect(usageToggle()).toBeChecked();
        expect(recordingsToggle()).toBeChecked();
    });

    it('turning session recordings back OFF persists and survives a refresh', async () => {
        const user = userEvent.setup();
        const first = renderPage();
        await user.click(recordingsToggle());
        await user.click(recordingsToggle());
        expect(recordingsToggle()).not.toBeChecked();
        first.unmount();

        renderPage();

        expect(recordingsToggle()).not.toBeChecked();
    });
});
