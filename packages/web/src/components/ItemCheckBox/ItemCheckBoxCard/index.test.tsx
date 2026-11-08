import type { Item } from '@tandra/types';
import { ListType } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemCheckBoxCard } from './index';

vi.mock('../QuantityBadge', () => ({
    QuantityBadge: ({ quantity, unit }: any) => (
        <div data-testid="quantity-badge">
            {quantity} {unit}
        </div>
    ),
}));

describe('ItemCheckBoxCard', () => {
    const mockItem: Item = {
        id: 'item-1',
        name: 'Milk',
        isSelected: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const mockOnToggle = vi.fn();
    const mockOnImageLoad = vi.fn();
    const mockOnImageError = vi.fn();

    const defaultProps = {
        item: mockItem,
        listType: ListType.SHOPPING,
        imageBlobUrl: null,
        hasLoadedImage: false,
        hasImageError: false,
        isLoading: false,
        isSelected: false,
        onToggle: mockOnToggle,
        onImageLoad: mockOnImageLoad,
        onImageError: mockOnImageError,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders item name', () => {
        render(<ItemCheckBoxCard {...defaultProps} />);

        expect(screen.getByText('Milk')).toBeInTheDocument();
    });

    it('calls onToggle when card is clicked', async () => {
        const user = userEvent.setup();
        render(<ItemCheckBoxCard {...defaultProps} />);

        const card = screen.getByRole('button');
        await user.click(card);

        expect(mockOnToggle).toHaveBeenCalled();
    });

    it('renders image for shopping list type', () => {
        render(
            <ItemCheckBoxCard
                {...defaultProps}
                listType={ListType.SHOPPING}
                imageBlobUrl="blob:mock-url"
                hasLoadedImage={true}
            />
        );

        const img = screen.getByAltText('Milk');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'blob:mock-url');
    });

    it('shows a plain check instead of the image slot when images are off, even after an image error', () => {
        render(
            <ItemCheckBoxCard {...defaultProps} showImage={false} imageBlobUrl="blob:mock-url" hasImageError={true} />
        );

        expect(screen.getByTestId('item-check')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Milk')).not.toBeInTheDocument();
    });

    it('shows selected state styling', () => {
        const { container } = render(<ItemCheckBoxCard {...defaultProps} isSelected={true} />);

        const card = container.querySelector('[role="button"]');
        expect(card).toHaveClass('bg-primary/10');
    });

    it('shows unselected state styling', () => {
        const { container } = render(<ItemCheckBoxCard {...defaultProps} isSelected={false} />);

        const card = container.querySelector('[role="button"]');
        expect(card).toHaveClass('hover:bg-accent/50');
    });

    it('renders QuantityBadge for shopping list', () => {
        const itemWithQuantity: Item = {
            ...mockItem,
            quantity: 2,
            unit: 'L',
        };

        render(<ItemCheckBoxCard {...defaultProps} item={itemWithQuantity} listType={ListType.SHOPPING} />);

        expect(screen.getByTestId('quantity-badge')).toBeInTheDocument();
    });

    it('shows loading spinner when isLoading is true', () => {
        const { container } = render(<ItemCheckBoxCard {...defaultProps} isLoading={true} />);

        const card = container.querySelector('[role="button"]');
        expect(card).toHaveClass('pointer-events-none');
    });

    it('calls onToggle on Enter key', async () => {
        const user = userEvent.setup();
        render(<ItemCheckBoxCard {...defaultProps} />);

        const card = screen.getByRole('button');
        card.focus();
        await user.keyboard('{Enter}');

        expect(mockOnToggle).toHaveBeenCalled();
    });

    it('calls onToggle on Space key', async () => {
        const user = userEvent.setup();
        render(<ItemCheckBoxCard {...defaultProps} />);

        const card = screen.getByRole('button');
        card.focus();
        await user.keyboard(' ');

        expect(mockOnToggle).toHaveBeenCalled();
    });

    it('marks the item as waiting to sync only while isPending', () => {
        const { rerender } = render(<ItemCheckBoxCard {...defaultProps} />);
        expect(screen.queryByTestId('item-pending')).not.toBeInTheDocument();

        rerender(<ItemCheckBoxCard {...defaultProps} isPending />);
        expect(screen.getByTestId('item-pending')).toHaveAttribute('aria-label', 'Waiting to sync');

        rerender(<ItemCheckBoxCard {...defaultProps} isPending={false} />);
        expect(screen.queryByTestId('item-pending')).not.toBeInTheDocument();
    });
});
