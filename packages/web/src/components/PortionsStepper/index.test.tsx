import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PortionsStepper } from '.';

describe('PortionsStepper', () => {
    it('renders the current value', () => {
        render(<PortionsStepper value={4} onChange={vi.fn()} />);
        expect(screen.getByTestId('portions-value')).toHaveTextContent('4');
    });

    it('calls onChange with value + 1 when the increase button is clicked', async () => {
        const onChange = vi.fn();
        render(<PortionsStepper value={4} onChange={onChange} />);

        await userEvent.click(screen.getByLabelText('Increase portions'));

        expect(onChange).toHaveBeenCalledWith(5);
    });

    it('calls onChange with value - 1 when the decrease button is clicked', async () => {
        const onChange = vi.fn();
        render(<PortionsStepper value={4} onChange={onChange} />);

        await userEvent.click(screen.getByLabelText('Decrease portions'));

        expect(onChange).toHaveBeenCalledWith(3);
    });

    it('clamps decreasing at the min value and disables the button', async () => {
        const onChange = vi.fn();
        render(<PortionsStepper value={1} onChange={onChange} min={1} />);

        const decreaseButton = screen.getByLabelText('Decrease portions');
        expect(decreaseButton).toBeDisabled();

        await userEvent.click(decreaseButton);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('defaults min to 1', () => {
        render(<PortionsStepper value={1} onChange={vi.fn()} />);
        expect(screen.getByLabelText('Decrease portions')).toBeDisabled();
    });
});
