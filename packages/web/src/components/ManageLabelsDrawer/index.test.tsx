import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManageLabelsDrawer } from './index';

const createLabel = vi.fn().mockResolvedValue(undefined);
const deleteLabel = vi.fn().mockResolvedValue(undefined);
let mockLabels: Array<{ id: string; name: string; color: string }> = [];

vi.mock('../../hooks/useLabels', () => ({
    useLabels: () => ({ labels: mockLabels, createLabel, deleteLabel, isLoading: false, refetch: vi.fn() }),
}));

describe('ManageLabelsDrawer', () => {
    const noop = () => {};

    beforeEach(() => {
        mockLabels = [];
        createLabel.mockClear();
        deleteLabel.mockClear();
    });

    it('shows an empty state when there are no labels', () => {
        render(<ManageLabelsDrawer open onOpenChange={noop} />);
        expect(screen.getByText('No labels yet')).toBeInTheDocument();
    });

    it('disables Add until a name is entered', () => {
        render(<ManageLabelsDrawer open onOpenChange={noop} />);
        const addButton = screen.getByRole('button', { name: 'Add' });
        expect(addButton).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Label name'), { target: { value: 'Work' } });
        expect(addButton).toBeEnabled();
    });

    it('creates a label and clears the input', async () => {
        render(<ManageLabelsDrawer open onOpenChange={noop} />);
        const input = screen.getByPlaceholderText('Label name');
        fireEvent.change(input, { target: { value: 'Work' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(createLabel).toHaveBeenCalledWith({ name: 'Work', color: '#3b82f6' }));
        await waitFor(() => expect(input).toHaveValue(''));
    });

    it('renders existing labels with a delete control', () => {
        mockLabels = [{ id: 'l1', name: 'Errands', color: '#ff0000' }];
        render(<ManageLabelsDrawer open onOpenChange={noop} />);
        expect(screen.getByText('Errands')).toBeInTheDocument();
    });
});
