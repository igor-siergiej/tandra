import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { AddRecipeHeader } from './AddRecipeHeader';

describe('AddRecipeHeader', () => {
    it('shows the title and a Cancel button by default', () => {
        render(<AddRecipeHeader onCancel={vi.fn()} />);
        expect(screen.getByRole('heading', { name: 'Create Recipe' })).toBeInTheDocument();
        expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    });

    it('calls onCancel when the Cancel button is clicked', async () => {
        const onCancel = vi.fn();
        render(<AddRecipeHeader onCancel={onCancel} />);
        await userEvent.click(screen.getByLabelText('Cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('hides the Cancel button when showCancel is false', () => {
        render(<AddRecipeHeader onCancel={vi.fn()} showCancel={false} />);
        expect(screen.getByRole('heading', { name: 'Create Recipe' })).toBeInTheDocument();
        expect(screen.queryByLabelText('Cancel')).not.toBeInTheDocument();
    });
});
