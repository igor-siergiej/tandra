import type { Ingredient } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IngredientSelectRow } from '.';

vi.mock('../../hooks/useItemImage', () => ({
    useItemImage: vi.fn(() => ({
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        onImageLoad: vi.fn(),
        onImageError: vi.fn(),
    })),
}));

import { useItemImage } from '../../hooks/useItemImage';

describe('IngredientSelectRow', () => {
    const mockIngredient: Ingredient = {
        id: 'ing-1',
        name: 'Tomato',
        quantity: 2,
        unit: 'pcs',
    };

    const mockOnToggle = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ingredient name', () => {
        render(<IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />);
        expect(screen.getByText('Tomato')).toBeInTheDocument();
    });

    it('renders quantity and unit when present', () => {
        render(<IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />);
        expect(screen.getByText('2 pcs')).toBeInTheDocument();
    });

    it('does not render quantity row when absent', () => {
        const noQty: Ingredient = { id: 'ing-2', name: 'Salt' };
        render(<IngredientSelectRow ingredient={noQty} isSelected={true} onToggle={mockOnToggle} />);
        expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('calls onToggle with ingredient id when clicked', async () => {
        const user = userEvent.setup();
        render(<IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />);
        await user.click(screen.getByRole('button'));
        expect(mockOnToggle).toHaveBeenCalledWith('ing-1');
    });

    it('applies selected styles when isSelected is true', () => {
        const { container } = render(
            <IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />
        );

        const btn = container.querySelector('button');
        expect(btn).toHaveClass('bg-primary/10');
    });

    it('applies unselected styles and line-through when isSelected is false', () => {
        const { container } = render(
            <IngredientSelectRow ingredient={mockIngredient} isSelected={false} onToggle={mockOnToggle} />
        );

        const btn = container.querySelector('button');
        expect(btn).toHaveClass('line-through');
        expect(btn).toHaveClass('bg-muted/30');
    });

    it('shows skeleton while image is loading', () => {
        const { container } = render(
            <IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />
        );

        const skeleton = container.querySelector('[data-slot="skeleton"]');
        expect(skeleton).toBeInTheDocument();
    });

    it('shows image when loaded', () => {
        vi.mocked(useItemImage).mockReturnValue({
            imageBlobUrl: 'blob:http://example.com/123',
            hasLoadedImage: true,
            hasImageError: false,
            onImageLoad: vi.fn(),
            onImageError: vi.fn(),
        });

        render(<IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />);
        const img = screen.getByAltText('Tomato');
        expect(img).toHaveClass('opacity-100');
        expect(img).toHaveAttribute('src', 'blob:http://example.com/123');
    });

    it('shows error icon when image fails to load', () => {
        vi.mocked(useItemImage).mockReturnValue({
            imageBlobUrl: null,
            hasLoadedImage: false,
            hasImageError: true,
            onImageLoad: vi.fn(),
            onImageError: vi.fn(),
        });

        const { container } = render(
            <IngredientSelectRow ingredient={mockIngredient} isSelected={true} onToggle={mockOnToggle} />
        );

        const errorContainer = container.querySelector('div[class*="rounded-full"]');
        expect(errorContainer).toBeInTheDocument();
        const icon = errorContainer?.querySelector('svg');
        expect(icon).toBeInTheDocument();
    });
});
