import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitSystemProvider } from '../../contexts/UnitSystemContext';
import SettingsPage from './index';

vi.mock('./AccountSection', () => ({ AccountSection: () => <section>Account section</section> }));

const renderPage = () =>
    render(
        <MemoryRouter>
            <UnitSystemProvider>
                <SettingsPage />
            </UnitSystemProvider>
        </MemoryRouter>
    );

describe('SettingsPage', () => {
    beforeEach(() => localStorage.clear());

    it('includes the account section', () => {
        renderPage();
        expect(screen.getByText('Account section')).toBeInTheDocument();
    });

    it('shows the unit options with Original selected by default', () => {
        renderPage();
        expect(screen.getByRole('radio', { name: /Original/ })).toBeChecked();
        expect(screen.getByRole('radio', { name: /Metric/ })).not.toBeChecked();
    });

    it('selecting Imperial checks it and persists the choice', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('radio', { name: /Imperial/ }));

        expect(screen.getByRole('radio', { name: /Imperial/ })).toBeChecked();
        expect(localStorage.getItem('unitSystem')).toBe('imperial');
    });

    it('keep-listening is off by default and persists when switched on', async () => {
        const user = userEvent.setup();
        renderPage();
        const toggle = screen.getByRole('checkbox', { name: /Keep listening until I tap stop/ });
        expect(toggle).not.toBeChecked();

        await user.click(toggle);

        expect(toggle).toBeChecked();
        expect(localStorage.getItem('tandra.voiceKeepListening')).toBe('true');
    });

    it('links to the privacy notice in a new tab', () => {
        renderPage();

        const link = screen.getByRole('link', { name: 'Privacy' });
        expect(link).toHaveAttribute('href', 'https://tandra.uk/privacy');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener');
    });
});
