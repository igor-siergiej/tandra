import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fake } from '../../testing/fake';
import { HandDrawnStrike } from './index';

const fakeRects = (count: number) => fake<DOMRectList>(Array.from({ length: count }, () => new DOMRect()));

describe('HandDrawnStrike', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the label with an unstruck stroke', () => {
        render(<HandDrawnStrike struck={false}>Milk</HandDrawnStrike>);

        expect(screen.getByText('Milk')).toBeInTheDocument();
        expect(screen.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'false');
    });

    it('marks the stroke as struck', () => {
        render(<HandDrawnStrike struck>Milk</HandDrawnStrike>);

        expect(screen.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'true');
        expect(screen.queryByTestId('strike-static')).not.toBeInTheDocument();
    });

    it('updates the stroke when toggled', () => {
        const { rerender } = render(<HandDrawnStrike struck={false}>Milk</HandDrawnStrike>);

        rerender(<HandDrawnStrike struck>Milk</HandDrawnStrike>);
        expect(screen.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'true');

        rerender(<HandDrawnStrike struck={false}>Milk</HandDrawnStrike>);
        expect(screen.getByTestId('strike-drawn')).toHaveAttribute('data-struck', 'false');
    });

    it('falls back to a static strike when the label wraps', () => {
        vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(fakeRects(2));

        render(<HandDrawnStrike struck>A very long item name that wraps</HandDrawnStrike>);

        expect(screen.queryByTestId('strike-drawn')).not.toBeInTheDocument();
        expect(screen.getByTestId('strike-static')).toHaveClass('line-through');
    });

    it('shows no static strike on a wrapped label that is not struck', () => {
        vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(fakeRects(2));

        render(<HandDrawnStrike struck={false}>A very long item name that wraps</HandDrawnStrike>);

        expect(screen.queryByTestId('strike-static')).not.toBeInTheDocument();
    });
});
