import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { TimeField } from './index';

describe('TimeField', () => {
    it('renders the label and current value', () => {
        render(<TimeField id="prep-time" label="Prep time" value="20" onChange={vi.fn()} />);

        expect(screen.getByLabelText('Prep time')).toHaveValue(20);
    });

    it('calls onChange with the typed value', async () => {
        const onChange = vi.fn();
        render(<TimeField id="prep-time" label="Prep time" value="" onChange={onChange} />);

        await userEvent.type(screen.getByLabelText('Prep time'), '5');

        expect(onChange).toHaveBeenLastCalledWith('5');
    });

    it('shows a unit suffix when provided', () => {
        render(<TimeField id="prep-time" label="Prep time" value="20" onChange={vi.fn()} suffix="min" />);

        expect(screen.getByText('min')).toBeInTheDocument();
    });

    it('omits the suffix when not provided', () => {
        render(<TimeField id="servings" label="Servings" value="4" onChange={vi.fn()} />);

        expect(screen.queryByText('min')).not.toBeInTheDocument();
    });
});
