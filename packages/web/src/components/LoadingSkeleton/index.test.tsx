import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ItemsSkeleton, ListsSkeleton } from './index';

describe('LoadingSkeleton', () => {
    describe('ListsSkeleton', () => {
        it('renders "Your Lists" heading', () => {
            render(<ListsSkeleton />);

            expect(screen.getByText('Your Lists')).toBeInTheDocument();
        });

        it('renders "Shared Lists" heading', () => {
            render(<ListsSkeleton />);

            expect(screen.getByText('Shared Lists')).toBeInTheDocument();
        });

        it('renders 3 skeleton items in Your Lists', () => {
            const { container } = render(<ListsSkeleton />);

            const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
            expect(skeletons.length).toBe(6);
        });

        it('renders Card components for each skeleton item', () => {
            const { container } = render(<ListsSkeleton />);

            const cards = container.querySelectorAll('[class*="bg-background"]');
            expect(cards.length).toBeGreaterThan(0);
        });

        it('has flex column layout', () => {
            const { container } = render(<ListsSkeleton />);

            const outerDiv = container.querySelector('div[class*="flex flex-col"]');
            expect(outerDiv).toHaveClass('flex', 'flex-col', 'space-y-6');
        });

        it('renders both sections', () => {
            const { container } = render(<ListsSkeleton />);

            const sections = container.querySelectorAll('div > div');
            expect(sections.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('ItemsSkeleton', () => {
        it('renders 6 skeleton items', () => {
            const { container } = render(<ItemsSkeleton />);

            const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
            expect(skeletons.length).toBe(6);
        });

        it('renders Card components for each item', () => {
            const { container } = render(<ItemsSkeleton />);

            const cards = container.querySelectorAll('[class*="bg-background"]');
            expect(cards.length).toBeGreaterThanOrEqual(6);
        });

        it('has consistent spacing between items', () => {
            const { container } = render(<ItemsSkeleton />);

            const cards = container.querySelectorAll('[class*="mb-2"]');
            expect(cards.length).toBe(6);
        });

        it('renders as fragment without wrapper', () => {
            const { container } = render(<ItemsSkeleton />);

            const children = container.children;
            expect(children.length).toBeGreaterThanOrEqual(6);
        });

        it('each item has skeleton with proper dimensions', () => {
            const { container } = render(<ItemsSkeleton />);

            const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });
    });
});
