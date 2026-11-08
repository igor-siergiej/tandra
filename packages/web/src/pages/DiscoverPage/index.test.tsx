import type { DiscoverySearchResult } from '@tandra/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../api';
import { narrowTo } from '../../testing/fake';
import DiscoverPage from './index';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../components/ToolBar', () => ({ default: () => <div data-testid="toolbar" /> }));

const FACETS = {
    tags: [
        { key: 'dessert', count: 12 },
        { key: 'cake', count: 5 },
    ],
    difficulty: [
        { key: 'medium', count: 7 },
        { key: 'easy', count: 4 },
    ],
    source: [{ key: 'wikibooks', count: 11 }],
    ingredients: [{ key: 'butter', count: 9 }],
    time: [
        { key: 'under-15', count: 0, to: 15 },
        { key: '15-30', count: 6, from: 15, to: 30 },
    ],
};

const response = (overrides: Partial<DiscoverySearchResult> = {}): DiscoverySearchResult => ({
    hits: [
        {
            id: 'wikibooks-1',
            title: 'Fairy Cakes',
            tags: ['cake', 'dessert'],
            prepTime: 15,
            cookTime: 20,
            servings: 12,
            difficulty: 'easy',
            source: 'wikibooks',
            estimated: ['prepTime', 'servings'],
        },
        { id: 'wikibooks-2', title: 'Lemon Drizzle', tags: [], source: 'wikibooks' },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
    facets: FACETS,
    ...overrides,
});

const renderPage = () =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter>
                <DiscoverPage />
            </MemoryRouter>
        </QueryClientProvider>
    );

describe('DiscoverPage', () => {
    let search: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        search = vi.spyOn(api, 'searchDiscoveryRecipes').mockResolvedValue(response());
    });

    it('lists library recipes with their meta and marks estimated values', async () => {
        renderPage();

        const card = await screen.findByRole('button', { name: /Fairy Cakes/ });
        expect(within(card).getByText('≈15m prep')).toBeInTheDocument();
        expect(within(card).getByText('20m cook')).toBeInTheDocument();
        expect(within(card).getByText('≈12 servings')).toBeInTheDocument();
        expect(within(card).getByText('Easy')).toBeInTheDocument();
        expect(screen.getByText('2 recipes')).toBeInTheDocument();
    });

    it('opens the preview for the tapped recipe', async () => {
        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: /Lemon Drizzle/ }));

        expect(mockNavigate).toHaveBeenCalledWith('/discover/wikibooks-2');
    });

    it('offers facet chips with counts and searches again when one is chosen', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Fairy Cakes/ });

        await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
        const panel = screen.getByTestId('discover-filters');
        expect(within(panel).getByRole('button', { name: 'Medium 7' })).toBeInTheDocument();
        expect(within(panel).getByRole('button', { name: 'dessert 12' })).toBeInTheDocument();
        expect(within(panel).getByRole('button', { name: '15-30 min 6' })).toBeInTheDocument();
        // A time range with no recipes is a dead end, so it is not offered.
        expect(within(panel).queryByRole('button', { name: /Under 15 min/ })).not.toBeInTheDocument();

        await userEvent.click(within(panel).getByRole('button', { name: 'dessert 12' }));

        await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['dessert'] })));
        expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
        expect(within(panel).getByRole('button', { name: 'dessert 12' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('searches by the typed text', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Fairy Cakes/ });

        await userEvent.type(screen.getByPlaceholderText(/Search recipes/), 'lemon');

        await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'lemon' })), {
            timeout: 2000,
        });
    });

    it('loads more results when there are further pages', async () => {
        search.mockImplementation(async ({ page }) =>
            page === 2
                ? response({
                      hits: [{ id: 'wikibooks-3', title: 'Third Recipe', tags: [], source: 'wikibooks' }],
                      page: 2,
                      pageSize: 2,
                      total: 3,
                  })
                : response({ pageSize: 2, total: 3 })
        );
        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

        expect(await screen.findByRole('button', { name: /Third Recipe/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Fairy Cakes/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('shows a clear "unavailable" state, with retry, when the search engine is down', async () => {
        search.mockRejectedValueOnce(
            Object.assign(new Error('Recipe discovery is temporarily unavailable'), { status: 503 })
        );
        renderPage();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Recipe discovery is unavailable');
        expect(alert).toHaveTextContent('Your own recipes and lists are not affected');

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findByRole('button', { name: /Fairy Cakes/ })).toBeInTheDocument();
    });

    it('says plainly when nothing matches and lets the filters be cleared', async () => {
        search.mockResolvedValue(response({ hits: [], total: 0 }));
        renderPage();

        expect(await screen.findByText('No recipes found')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
        await userEvent.click(
            within(screen.getByTestId('discover-filters')).getByRole('button', { name: 'dessert 12' })
        );

        const clear = await screen.findAllByRole('button', { name: 'Clear filters' });
        await userEvent.click(narrowTo(clear[0], HTMLElement));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument());
    });
});
