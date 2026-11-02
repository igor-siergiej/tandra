import type { DiscoverySearchResult } from '@tandra/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../api';
import { useDiscoverySearch } from './useDiscoverySearch';

const hit = (id: string) => ({ id, title: `Recipe ${id}`, tags: [], source: 'wikibooks' as const });

const result = (overrides: Partial<DiscoverySearchResult> = {}): DiscoverySearchResult => ({
    hits: [hit('a')],
    total: 1,
    page: 1,
    pageSize: 20,
    facets: { tags: [], difficulty: [], source: [], ingredients: [], time: [] },
    ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

const lastQuery = (search: ReturnType<typeof vi.spyOn>) => search.mock.calls.at(-1)?.[0];

describe('useDiscoverySearch', () => {
    let search: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        search = vi.spyOn(api, 'searchDiscoveryRecipes').mockResolvedValue(result());
    });

    it('browses the whole library first: no text, no filters', async () => {
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });

        await waitFor(() => expect(hook.current.hits).toHaveLength(1));
        expect(lastQuery(search)).toMatchObject({ q: undefined, tags: [], difficulty: [], page: 1 });
    });

    it('waits for typing to settle before searching, and trims the text', async () => {
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });
        await waitFor(() => expect(hook.current.hits).toHaveLength(1));
        search.mockClear();

        act(() => hook.current.setText('  lemon '));
        act(() => hook.current.setText('  lemon cake '));
        expect(search).not.toHaveBeenCalled();

        await waitFor(() => expect(lastQuery(search)).toMatchObject({ q: 'lemon cake' }), { timeout: 2000 });
        expect(search.mock.calls.every(([query]) => query.q !== 'lemon')).toBe(true);
    });

    it('turns facet selections into API filters, mapping a time bucket onto inclusive bounds', async () => {
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });
        await waitFor(() => expect(hook.current.hits).toHaveLength(1));

        act(() => hook.current.toggleTag('dessert'));
        act(() => hook.current.toggleIngredient('onion, chopped'));
        act(() => hook.current.toggleDifficulty('easy'));
        act(() => hook.current.toggleTime({ key: '15-30', from: 15, to: 30 }));

        await waitFor(() =>
            expect(lastQuery(search)).toMatchObject({
                tags: ['dessert'],
                ingredients: ['onion, chopped'],
                difficulty: ['easy'],
                // The bucket is [15, 30): the API's maxTime is inclusive.
                minTime: 15,
                maxTime: 29,
            })
        );
        expect(hook.current.activeFilterCount).toBe(4);
    });

    it('leaves the open end of a time bucket unbounded', async () => {
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });
        await waitFor(() => expect(hook.current.hits).toHaveLength(1));

        act(() => hook.current.toggleTime({ key: 'over-120', from: 120 }));

        await waitFor(() => expect(lastQuery(search)).toMatchObject({ minTime: 120, maxTime: undefined }));
    });

    it('deselects a value or time bucket on a second toggle', async () => {
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });
        await waitFor(() => expect(hook.current.hits).toHaveLength(1));

        act(() => hook.current.toggleTag('dessert'));
        act(() => hook.current.toggleTag('dessert'));
        act(() => hook.current.toggleTime({ key: 'under-15', to: 15 }));
        act(() => hook.current.toggleTime({ key: 'under-15', to: 15 }));

        expect(hook.current.activeFilterCount).toBe(0);
    });

    it('clears filters but keeps what was typed', async () => {
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });
        await waitFor(() => expect(hook.current.hits).toHaveLength(1));

        act(() => hook.current.setText('cake'));
        act(() => hook.current.toggleDifficulty('hard'));
        act(() => hook.current.clearFilters());

        expect(hook.current.filters).toMatchObject({ text: 'cake', difficulty: [], tags: [], time: null });
    });

    it('loads further pages and accumulates their hits until the last page', async () => {
        search.mockImplementation(async ({ page }) =>
            page === 2
                ? result({ hits: [hit('b')], total: 2, page: 2, pageSize: 1 })
                : result({ hits: [hit('a')], total: 2, page: 1, pageSize: 1 })
        );
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });
        await waitFor(() => expect(hook.current.hasNextPage).toBe(true));

        act(() => hook.current.loadMore());

        await waitFor(() => expect(hook.current.hits.map((h) => h.id)).toEqual(['a', 'b']));
        expect(lastQuery(search)).toMatchObject({ page: 2 });
        expect(hook.current.hasNextPage).toBe(false);
        expect(hook.current.total).toBe(2);
    });

    it('reports the HTTP status of a failed search so the page can tell "down" from "broken"', async () => {
        search.mockRejectedValue(Object.assign(new Error('unavailable'), { status: 503 }));
        const { result: hook } = renderHook(() => useDiscoverySearch(), { wrapper });

        await waitFor(() => expect(hook.current.isError).toBe(true));
        expect(hook.current.errorStatus).toBe(503);
    });
});
