import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { ChoiceScreen } from './ChoiceScreen';

// Regression coverage for tandra-add-recipe-choice-dialog: the choice is now a modal
// overlay with a footer-only Cancel, not a full-page screen with a header X.
describe('ChoiceScreen', () => {
    it('renders both options and no header Cancel (X) button', () => {
        render(<ChoiceScreen onSelectImport={vi.fn()} onSelectManual={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Import from a link/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add manually/ })).toBeInTheDocument();
        expect(screen.queryByLabelText('Cancel', { selector: 'button' })).not.toBeInTheDocument();
    });

    it('calls onSelectImport when "Import from a link" is chosen', async () => {
        const onSelectImport = vi.fn();
        render(<ChoiceScreen onSelectImport={onSelectImport} onSelectManual={vi.fn()} onCancel={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: /Import from a link/ }));
        expect(onSelectImport).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectManual when "Add manually" is chosen', async () => {
        const onSelectManual = vi.fn();
        render(<ChoiceScreen onSelectImport={vi.fn()} onSelectManual={onSelectManual} onCancel={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: /Add manually/ }));
        expect(onSelectManual).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when the footer Cancel button is clicked', async () => {
        const onCancel = vi.fn();
        render(<ChoiceScreen onSelectImport={vi.fn()} onSelectManual={vi.fn()} onCancel={onCancel} />);
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onCancel).toHaveBeenCalled();
    });
});
