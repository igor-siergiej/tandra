import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuantityUnitField } from './index';

describe('QuantityUnitField', () => {
    const mockOnQuantityChange = vi.fn();
    const mockOnUnitChange = vi.fn();

    beforeEach(() => {
        mockOnQuantityChange.mockClear();
        mockOnUnitChange.mockClear();
    });

    it('renders quantity and unit inputs', () => {
        const { container } = render(
            <QuantityUnitField
                quantity="5"
                unit="pcs"
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
            />
        );

        const quantityInput = screen.getByDisplayValue('5');
        const unitTrigger = container.querySelector('[id="unit"]');

        expect(quantityInput).toBeInTheDocument();
        expect(unitTrigger).toBeInTheDocument();
        expect(unitTrigger).toHaveTextContent('pcs');
    });

    it('displays quantity label', () => {
        render(
            <QuantityUnitField
                quantity=""
                unit=""
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
            />
        );

        expect(screen.getByText('Quantity')).toBeInTheDocument();
        expect(screen.getByText('Unit')).toBeInTheDocument();
    });

    it('calls onQuantityChange when quantity input changes', async () => {
        const user = userEvent.setup();
        render(
            <QuantityUnitField
                quantity=""
                unit="pcs"
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
            />
        );

        const quantityInput = screen.getByRole('spinbutton') as HTMLInputElement;
        await user.clear(quantityInput);
        await user.type(quantityInput, '10');

        expect(mockOnQuantityChange).toHaveBeenCalled();
    });

    it('calls onUnitChange when unit select changes', async () => {
        const user = userEvent.setup();

        const { container } = render(
            <QuantityUnitField
                quantity="5"
                unit="pcs"
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
            />
        );

        const unitTrigger = container.querySelector('[id="unit"]') as HTMLElement;
        await user.click(unitTrigger);

        const kgOption = screen.getByText('kg');
        await user.click(kgOption);

        expect(mockOnUnitChange).toHaveBeenCalledWith('kg');
    });

    it('supports decimal quantities with step 0.01', () => {
        const { container } = render(
            <QuantityUnitField
                quantity="2.5"
                unit="kg"
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
            />
        );

        const input = container.querySelector('input[type="number"]') as HTMLInputElement;
        expect(input?.step).toBe('0.01');
        expect(input?.value).toBe('2.5');
    });

    it('has all unit options available', async () => {
        const { container } = render(
            <QuantityUnitField
                quantity=""
                unit="pcs"
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
            />
        );

        const unitTrigger = container.querySelector('[id="unit"]') as HTMLElement;
        await userEvent.setup().click(unitTrigger);

        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();

        const options = listbox.querySelectorAll('[role="option"]');
        const optionTexts = Array.from(options).map((opt) => opt.textContent?.trim());

        expect(optionTexts).toContain('pcs');
        expect(optionTexts).toContain('g');
        expect(optionTexts).toContain('kg');
        expect(optionTexts).toContain('ml');
        expect(optionTexts).toContain('L');
    });

    it('uses custom IDs when provided', () => {
        const { container } = render(
            <QuantityUnitField
                quantity="3"
                unit="ml"
                onQuantityChange={mockOnQuantityChange}
                onUnitChange={mockOnUnitChange}
                quantityId="custom-qty"
                unitId="custom-unit"
            />
        );

        const quantityInput = container.querySelector('#custom-qty');
        const unitSelect = container.querySelector('#custom-unit');

        expect(quantityInput).toBeInTheDocument();
        expect(unitSelect).toBeInTheDocument();
    });
});
