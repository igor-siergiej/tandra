import type { Recipe } from '@tandra/types';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { RecipeCard } from './index';

describe('RecipeCard', () => {
    const mockRecipe: Recipe = {
        id: 'recipe-1',
        title: 'Test Recipe',
        ownerId: 'user-1',
        coverImageKey: 'test-image',
        ingredients: [
            { id: 'ing-1', name: 'Ingredient 1' },
            { id: 'ing-2', name: 'Ingredient 2' },
        ],
        users: [
            { id: 'user-1', username: 'owner' },
            { id: 'user-2', username: 'friend' },
        ],
        dateAdded: new Date(),
    };

    const mockRecipeNoImage: Recipe = {
        ...mockRecipe,
        coverImageKey: undefined,
    };

    beforeEach(() => {
        // Mock fetch for image loading
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(new Blob(['image data'])),
            } as Response)
        );

        // Mock URL.createObjectURL and revokeObjectURL
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
    });

    it('renders recipe card with title', () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        expect(screen.getByText('Test Recipe')).toBeTruthy();
    });

    it('displays ingredient count', () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        expect(screen.getByText('2 ingredients')).toBeTruthy();
    });

    it('fetches and displays image when coverImageKey is present', async () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/api/image/${encodeURIComponent(mockRecipe.coverImageKey)}`)
            );
        });

        // Should create object URL for the image
        await waitFor(() => {
            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });
    });

    it('shows skeleton when no coverImageKey', () => {
        const { container } = render(
            <RecipeCard recipe={mockRecipeNoImage} currentUserId="user-1" onClick={vi.fn()} />
        );

        expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    });

    it('calls onClick when card is clicked', () => {
        const mockClick = vi.fn();

        const { container } = render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={mockClick} />);

        const card = container.querySelector('[role="button"]');

        if (card) {
            card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }

        expect(mockClick).toHaveBeenCalled();
    });

    it('handles image fetch error gracefully', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
            } as Response)
        );

        const { container } = render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        await waitFor(() => {
            // Should show error icon (ImageOff SVG)
            expect(container.querySelector('svg')).toBeTruthy();
        });
    });

    it('shows an avatar for each other member, including for the owner', () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        expect(screen.getByTitle('friend')).toBeTruthy();
    });

    it('excludes the current user from the avatar stack', () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-2" onClick={vi.fn()} />);

        expect(screen.queryByTitle('friend')).toBeNull();
        expect(screen.getByTitle('owner')).toBeTruthy();
    });

    it('stacks the meta chips in a centred column when the recipe is not shared', () => {
        const unsharedRecipe: Recipe = { ...mockRecipe, users: [{ id: 'user-1', username: 'owner' }] };
        render(<RecipeCard recipe={unsharedRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        const meta = screen.getByText('2 ingredients').parentElement as HTMLElement;
        expect(meta.className).toContain('flex-col');
        expect((meta.parentElement as HTMLElement).className).toContain('justify-center');
    });

    it('stacks the meta chips with the avatar stack directly beneath when the recipe is shared', () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        const meta = screen.getByText('2 ingredients').parentElement as HTMLElement;
        expect(meta.className).toContain('flex-col');
        expect((meta.parentElement as HTMLElement).className).toContain('justify-center');
        expect(meta.nextElementSibling?.contains(screen.getByTitle('friend'))).toBe(true);
    });

    it('shows prep, cook and servings chips when the recipe has those fields', () => {
        const recipeWithTimes: Recipe = {
            ...mockRecipe,
            prepTime: 20,
            cookTime: 15,
            servings: 4,
        };

        render(<RecipeCard recipe={recipeWithTimes} currentUserId="user-1" onClick={vi.fn()} />);

        expect(screen.getByText('20m prep')).toBeTruthy();
        expect(screen.getByText('15m cook')).toBeTruthy();
        expect(screen.getByText('4 servings')).toBeTruthy();
    });

    it('omits prep, cook and servings chips when those fields are undefined', () => {
        render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        expect(screen.queryByText(/m prep/)).toBeNull();
        expect(screen.queryByText(/m cook/)).toBeNull();
        expect(screen.queryByText(/servings?/)).toBeNull();
    });

    it('singularises the servings label when there is exactly one', () => {
        const recipeForOne: Recipe = { ...mockRecipe, servings: 1 };
        render(<RecipeCard recipe={recipeForOne} currentUserId="user-1" onClick={vi.fn()} />);

        expect(screen.getByText('1 serving')).toBeTruthy();
    });

    it('cleans up object URL on unmount', async () => {
        const { unmount } = render(<RecipeCard recipe={mockRecipe} currentUserId="user-1" onClick={vi.fn()} />);

        await waitFor(() => {
            expect(global.URL.createObjectURL).toHaveBeenCalled();
        });

        unmount();

        expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
});
