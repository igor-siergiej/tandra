import type { DiscoveryFacets, DiscoveryRecipeSummary, DiscoverySearchQuery, RecipeDifficulty } from '@tandra/types';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { searchDiscoveryRecipes } from '../api';
import { useDebouncedValue } from './useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;

/** A facet time bucket as the API describes it: inclusive lower bound, exclusive upper bound, in total minutes. */
export interface DiscoveryTimeFilter {
    key: string;
    from?: number;
    to?: number;
}

export interface DiscoveryFilterState {
    text: string;
    tags: string[];
    ingredients: string[];
    difficulty: RecipeDifficulty[];
    time: DiscoveryTimeFilter | null;
}

const EMPTY_FILTERS: DiscoveryFilterState = { text: '', tags: [], ingredients: [], difficulty: [], time: null };

const toggled = <T>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

// The API's maxTime is inclusive while a bucket's upper bound is exclusive.
// One optional bound or list per filter.
// fallow-ignore-next-line complexity
const toQuery = (filters: DiscoveryFilterState, text: string): DiscoverySearchQuery => ({
    q: text.trim() || undefined,
    tags: filters.tags,
    ingredients: filters.ingredients,
    difficulty: filters.difficulty,
    minTime: filters.time?.from,
    maxTime: filters.time?.to === undefined ? undefined : filters.time.to - 1,
});

const activeFilterCount = (filters: DiscoveryFilterState): number =>
    filters.tags.length + filters.ingredients.length + filters.difficulty.length + (filters.time ? 1 : 0);

export interface DiscoverySearch {
    filters: DiscoveryFilterState;
    activeFilterCount: number;
    setText: (text: string) => void;
    toggleTag: (tag: string) => void;
    toggleIngredient: (ingredient: string) => void;
    toggleDifficulty: (difficulty: RecipeDifficulty) => void;
    toggleTime: (time: DiscoveryTimeFilter) => void;
    clearFilters: () => void;
    hits: DiscoveryRecipeSummary[];
    total: number;
    facets: DiscoveryFacets | undefined;
    isLoading: boolean;
    isError: boolean;
    /** HTTP status of the failure, when there was one: 503 means the search engine is down. */
    errorStatus: number | undefined;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadMore: () => void;
    retry: () => void;
}

/**
 * Search state + results for the Discover page. Facet counts come back with every page of results and describe the
 * whole result set, so they are read from the first page; hits accumulate across pages for "load more".
 */
// One state setter per filter kind, plus the paged query.
// fallow-ignore-next-line complexity
export const useDiscoverySearch = (): DiscoverySearch => {
    const [filters, setFilters] = useState<DiscoveryFilterState>(EMPTY_FILTERS);
    const text = useDebouncedValue(filters.text, SEARCH_DEBOUNCE_MS);
    const query = useMemo(() => toQuery(filters, text), [filters, text]);

    const result = useInfiniteQuery({
        queryKey: ['discover-search', query],
        queryFn: ({ pageParam }) => searchDiscoveryRecipes({ ...query, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
        // Keep the old facets and hits on screen while a refined search loads, rather than flashing empty.
        placeholderData: keepPreviousData,
    });

    const update = useCallback(
        (patch: Partial<DiscoveryFilterState>) => setFilters((old) => ({ ...old, ...patch })),
        []
    );

    const { fetchNextPage, refetch } = result;

    // SAFETY: react-query errors from makeRequest are Errors carrying an optional numeric `status`.
    return {
        filters,
        activeFilterCount: activeFilterCount(filters),
        setText: (value) => update({ text: value }),
        toggleTag: (tag) => setFilters((old) => ({ ...old, tags: toggled(old.tags, tag) })),
        toggleIngredient: (name) => setFilters((old) => ({ ...old, ingredients: toggled(old.ingredients, name) })),
        toggleDifficulty: (level) => setFilters((old) => ({ ...old, difficulty: toggled(old.difficulty, level) })),
        toggleTime: (time) => setFilters((old) => ({ ...old, time: old.time?.key === time.key ? null : time })),
        clearFilters: () => setFilters((old) => ({ ...EMPTY_FILTERS, text: old.text })),
        hits: result.data?.pages.flatMap((page) => page.hits) ?? [],
        total: result.data?.pages[0]?.total ?? 0,
        facets: result.data?.pages[0]?.facets,
        isLoading: result.isLoading,
        isError: result.isError,
        errorStatus: (result.error as { status?: number } | null)?.status,
        hasNextPage: result.hasNextPage ?? false,
        isFetchingNextPage: result.isFetchingNextPage,
        loadMore: () => void fetchNextPage(),
        retry: () => void refetch(),
    };
};
