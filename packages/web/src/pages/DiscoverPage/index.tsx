import { AlertTriangle, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PinnedSearchField } from '../../components/PinnedSearchField';
import ToolBar from '../../components/ToolBar';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { Skeleton } from '../../components/ui/skeleton';
import { type DiscoverySearch, useDiscoverySearch } from '../../hooks/useDiscoverySearch';
import { FilterPanel } from './FilterPanel';
import { ResultCard } from './ResultCard';

const UNAVAILABLE = 503;

const ErrorState = ({ search }: { search: DiscoverySearch }) => (
    <div role="alert" className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-semibold">
                {search.errorStatus === UNAVAILABLE ? 'Recipe discovery is unavailable' : 'Unable to search recipes'}
            </span>
        </div>
        <p className="mb-4 max-w-sm text-muted-foreground">
            {search.errorStatus === UNAVAILABLE
                ? 'The recipe library is temporarily out of reach. Your own recipes and lists are not affected.'
                : 'Please check your connection and try again.'}
        </p>
        <Button onClick={search.retry}>Retry</Button>
    </div>
);

const NoResults = ({ search }: { search: DiscoverySearch }) => (
    <Empty className="flex-none justify-start p-4">
        <EmptyHeader>
            <EmptyMedia variant="icon">
                <Search />
            </EmptyMedia>
            <EmptyTitle>No recipes found</EmptyTitle>
            <EmptyDescription>Try a different search term or fewer filters</EmptyDescription>
        </EmptyHeader>
        {search.activeFilterCount > 0 && (
            <Button variant="outline" onClick={search.clearFilters}>
                Clear filters
            </Button>
        )}
    </Empty>
);

const ResultsSkeleton = () => (
    <div className="space-y-2">
        {['a', 'b', 'c', 'd'].map((key) => (
            <Skeleton key={key} className="h-20 w-full rounded-2xl" />
        ))}
    </div>
);

const FilterToggle = ({
    count,
    open,
    onToggle,
    onClear,
}: {
    count: number;
    open: boolean;
    onToggle: () => void;
    onClear: () => void;
}) => (
    <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" aria-expanded={open} onClick={onToggle}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{count > 0 ? ` (${count})` : ''}
        </Button>
        {count > 0 && (
            <button type="button" onClick={onClear} className="text-xs text-muted-foreground underline">
                Clear filters
            </button>
        )}
    </div>
);

// Browse + search the shared library. Full page (not a drawer) so results are never squashed behind the keyboard, with
// the same bottom-pinned search field as the Recipes page.
// fallow-ignore-next-line complexity
const DiscoverPage = () => {
    const navigate = useNavigate();
    const search = useDiscoverySearch();
    const [filtersOpen, setFiltersOpen] = useState(false);

    let results: React.ReactNode;
    if (search.isError) results = <ErrorState search={search} />;
    else if (search.isLoading) results = <ResultsSkeleton />;
    else if (search.hits.length === 0) results = <NoResults search={search} />;
    else {
        results = (
            <div className="space-y-2">
                {search.hits.map((recipe) => (
                    <ResultCard key={recipe.id} recipe={recipe} onClick={() => navigate(`/discover/${recipe.id}`)} />
                ))}
                {search.hasNextPage && (
                    <Button
                        variant="outline"
                        className="w-full"
                        disabled={search.isFetchingNextPage}
                        onClick={search.loadMore}
                    >
                        {search.isFetchingNextPage ? 'Loading...' : 'Load more'}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="flex min-h-full flex-col justify-between">
                <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <h2 className="text-lg font-semibold text-foreground">Discover recipes</h2>
                        {!(search.isError || search.isLoading) && (
                            <span className="text-xs text-muted-foreground">
                                {search.total} {search.total === 1 ? 'recipe' : 'recipes'}
                            </span>
                        )}
                    </div>
                    {search.facets && (
                        <>
                            <FilterToggle
                                count={search.activeFilterCount}
                                open={filtersOpen}
                                onToggle={() => setFiltersOpen((open) => !open)}
                                onClear={search.clearFilters}
                            />
                            {filtersOpen && <FilterPanel search={search} facets={search.facets} />}
                        </>
                    )}
                    {results}
                </div>
                <PinnedSearchField
                    value={search.filters.text}
                    onChange={search.setText}
                    placeholder="Search recipes, e.g. lemon cake"
                    name="discover-search"
                />
            </div>

            <ToolBar />
        </>
    );
};

export default DiscoverPage;
