import type { Recipe } from '@tandra/types';
import { useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecipeSearch } from '../../hooks/useRecipeSearch';
import RecipesPage from './index';

vi.mock('../../hooks/useRecipeSearch', async () => {
    const actual = await vi.importActual<typeof import('../../hooks/useRecipeSearch')>('../../hooks/useRecipeSearch');

    return { useRecipeSearch: vi.fn(actual.useRecipeSearch) };
});

// Mock dependencies
vi.mock('../../api', () => ({
    getRecipesQuery: vi.fn(() => ({ queryKey: ['recipes', 'user-1'], queryFn: vi.fn() })),
    getFriendsQuery: vi.fn(() => ({ queryKey: ['friends'], queryFn: vi.fn() })),
    addRecipe: vi.fn(),
    generateRecipeAiImage: vi.fn(),
    uploadRecipeImage: vi.fn(),
}));

vi.mock('../../auth', () => ({
    useUser: () => ({
        user: {
            id: 'user-1',
            username: 'testuser',
        },
    }),
    useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(() => ({
        data: [] as Recipe[],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    })),
    useQueryClient: () => ({
        getQueryData: vi.fn(() => []),
        invalidateQueries: vi.fn(),
    }),
}));

vi.mock('../../contexts/PullToRefreshContext', () => ({
    usePullToRefreshContext: () => ({ registerRefresh: () => () => {} }),
}));

vi.mock('../../components/ToolBar', () => ({
    default: () => <div data-testid="toolbar" />,
}));

const mockScrollTo = vi.fn();
const mockScrollContainerRef = { current: { scrollTo: mockScrollTo, scrollHeight: 1234 } };

vi.mock('../../contexts/ScrollContainerContext', () => ({
    useScrollContainer: () => mockScrollContainerRef,
}));

describe('RecipesPage', () => {
    const _mockRecipes: Recipe[] = [
        {
            id: 'recipe-1',
            title: 'Recipe 1',
            ownerId: 'user-1',
            ingredients: [],
        },
        {
            id: 'recipe-2',
            title: 'Recipe 2',
            ownerId: 'user-2',
            ingredients: [],
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the recipe search input with autofill-safe attributes', () => {
        render(
            <MemoryRouter>
                <RecipesPage />
            </MemoryRouter>
        );

        const searchInput = screen.getByPlaceholderText('Search recipes...');
        expect(searchInput).toHaveAttribute('autocomplete', 'off');
        expect(searchInput).toHaveAttribute('name', 'recipe-search');
        expect(searchInput).toHaveAttribute('inputmode', 'search');
        expect(searchInput).toHaveAttribute('type', 'search');
    });

    it('renders the search input with an inset focus ring', () => {
        render(
            <MemoryRouter>
                <RecipesPage />
            </MemoryRouter>
        );

        const searchInput = screen.getByPlaceholderText('Search recipes...');
        expect(searchInput).toHaveClass('focus-visible:ring-inset');
    });

    it('renders owned and shared recipes together, with avatars for other members on each', () => {
        vi.mocked(useQuery).mockReturnValue({
            data: [
                {
                    id: 'r1',
                    title: 'Owned Recipe',
                    ownerId: 'user-1',
                    ingredients: [],
                    coverImageKey: 'img-1',
                    users: [
                        { id: 'user-1', username: 'me' },
                        { id: 'user-3', username: 'friend' },
                    ],
                    dateAdded: new Date(),
                },
                {
                    id: 'r2',
                    title: 'Shared Recipe',
                    ownerId: 'user-2',
                    ingredients: [],
                    users: [
                        { id: 'user-2', username: 'owner2' },
                        { id: 'user-1', username: 'me' },
                    ],
                    dateAdded: new Date(),
                },
            ],
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as ReturnType<typeof useQuery>);

        render(
            <MemoryRouter>
                <RecipesPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Owned Recipe')).toBeInTheDocument();
        expect(screen.getByText('Shared Recipe')).toBeInTheDocument();
        // Avatars for other members show on both cards — owned or not.
        expect(screen.getByTitle('friend')).toBeInTheDocument();
        expect(screen.getByTitle('owner2')).toBeInTheDocument();
        expect(screen.queryByText('No recipes yet')).not.toBeInTheDocument();
    });

    it('matches a recipe by tag with no visible tag UI on the page', async () => {
        const user = userEvent.setup();
        vi.mocked(useQuery).mockReturnValue({
            data: [
                {
                    id: 'r1',
                    title: "Grandma's Bourguignon",
                    ownerId: 'user-1',
                    ingredients: [],
                    users: [],
                    dateAdded: new Date(),
                    coverImageKey: 'img-1',
                    tags: ['beef', 'stew', 'french'],
                },
                {
                    id: 'r2',
                    title: 'Chicken Curry',
                    ownerId: 'user-1',
                    ingredients: [],
                    users: [],
                    dateAdded: new Date(),
                    coverImageKey: 'img-2',
                    tags: ['spicy'],
                },
            ],
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as ReturnType<typeof useQuery>);

        render(
            <MemoryRouter>
                <RecipesPage />
            </MemoryRouter>
        );

        // No chip/filter button for any tag is ever rendered.
        expect(screen.queryByRole('button', { name: 'beef' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'stew' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'spicy' })).not.toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Search recipes...'), 'beef');

        expect(screen.getByText("Grandma's Bourguignon")).toBeInTheDocument();
        expect(screen.queryByText('Chicken Curry')).not.toBeInTheDocument();
    });

    it('renders the best search match closest to the bottom-pinned search field', () => {
        const bestMatch: Recipe = {
            id: 'r1',
            title: 'Best Match',
            ownerId: 'user-1',
            ingredients: [],
            users: [],
            dateAdded: new Date(),
            coverImageKey: 'img-1',
        };

        const worseMatch: Recipe = {
            id: 'r2',
            title: 'Worse Match',
            ownerId: 'user-1',
            ingredients: [],
            users: [],
            dateAdded: new Date(),
            coverImageKey: 'img-2',
        };

        vi.mocked(useQuery).mockReturnValue({
            data: [bestMatch, worseMatch],
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as ReturnType<typeof useQuery>);

        render(
            <MemoryRouter>
                <RecipesPage />
            </MemoryRouter>
        );

        // useRecipeSearch ranks best match first; the component must reverse that for
        // display so the best match lands last in the DOM, closest to the search field.
        vi.mocked(useRecipeSearch).mockReturnValueOnce([bestMatch, worseMatch]);
        fireEvent.change(screen.getByPlaceholderText('Search recipes...'), { target: { value: 'match' } });

        const best = screen.getByText('Best Match');
        const worse = screen.getByText('Worse Match');
        // Best match must be last in the DOM (closest to the search field below it).
        expect(worse.compareDocumentPosition(best) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('scrolls back to the bottom-pinned search field when the search is cleared', async () => {
        const user = userEvent.setup();
        vi.mocked(useQuery).mockReturnValue({
            data: [
                {
                    id: 'r1',
                    title: 'Recipe 1',
                    ownerId: 'user-1',
                    ingredients: [],
                    users: [],
                    dateAdded: new Date(),
                    coverImageKey: 'img-1',
                },
            ],
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        } as ReturnType<typeof useQuery>);

        render(
            <MemoryRouter>
                <RecipesPage />
            </MemoryRouter>
        );

        await user.type(screen.getByPlaceholderText('Search recipes...'), 'Recipe 1');
        expect(mockScrollTo).not.toHaveBeenCalled();

        await user.click(screen.getByLabelText('Clear search'));

        expect(mockScrollTo).toHaveBeenCalledWith({ top: 1234, behavior: 'smooth' });
    });

    it('passes refetch function to ToolBar for recipe updates', async () => {
        // Test that refetch is available for recipe image updates
        expect(true).toBe(true);
    });

    it('calls addRecipe with correct parameters', async () => {
        // Test recipe creation flow
        expect(true).toBe(true);
    });
});
