import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChefHat, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { generateRecipeAiImage, getRecipesQuery } from '../../api';
import { useUser } from '../../auth';
import { ListsSkeleton } from '../../components/LoadingSkeleton';
import { PinnedSearchField } from '../../components/PinnedSearchField';
import { RecipesList } from '../../components/RecipesList';
import ToolBar from '../../components/ToolBar';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { usePullToRefreshContext } from '../../contexts/PullToRefreshContext';
import { useScrollContainer } from '../../contexts/ScrollContainerContext';
import { useRecipeSearch } from '../../hooks/useRecipeSearch';
import { aiTagPollInterval } from '../../utils/aiTagPoll';
import { logger } from '../../utils/logger';

// Several independent effects (logging, error logging, background AI-image backfill, shared-url
// redirect) plus search state; each effect is already a single, separately-testable concern.
// fallow-ignore-next-line complexity
const RecipesPage = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const generatingRef = useRef<Set<string>>(new Set());
    const prevSearchQueryRef = useRef(searchQuery);
    const scrollContainerRef = useScrollContainer();
    const { data, isLoading, isError, refetch } = useQuery({
        ...getRecipesQuery(user?.id || ''),
        enabled: !!user?.id,
        refetchInterval: (query) => aiTagPollInterval(query.state.data),
    });
    const { registerRefresh } = usePullToRefreshContext();

    useEffect(() => {
        return registerRefresh(async () => {
            await refetch();
        });
    }, [registerRefresh, refetch]);

    // fallow-ignore-next-line complexity
    useEffect(() => {
        if (user?.id) {
            logger.info('Recipes page loaded', {
                userId: user.id,
                username: user.username,
                recipeCount: data?.length || 0,
            });
        }
    }, [user?.id, user?.username, data?.length]);

    useEffect(() => {
        if (isError) {
            logger.error('Failed to load recipes', { userId: user?.id });
        }
    }, [isError, user?.id]);

    // fallow-ignore-next-line complexity
    useEffect(() => {
        if (!data || !user?.id) return;
        const missing = data.filter((r) => !r.coverImageKey && r.ownerId === user.id);
        for (const recipe of missing) {
            if (generatingRef.current.has(recipe.id)) continue;
            generatingRef.current.add(recipe.id);
            void generateRecipeAiImage(recipe.id).then(() =>
                queryClient.invalidateQueries({ queryKey: getRecipesQuery(user.id).queryKey })
            );
        }
    }, [data, user?.id, queryClient]);

    useEffect(() => {
        const url = searchParams.get('sharedUrl');
        if (url) {
            navigate(`/recipes/new?sharedUrl=${encodeURIComponent(url)}`, { replace: true });
        }
    }, [searchParams, navigate]);

    // Search results build upward from the bottom-pinned search field; clearing the
    // search should scroll back down to it rather than leaving the view scrolled up.
    useEffect(() => {
        if (prevSearchQueryRef.current && !searchQuery) {
            const container = scrollContainerRef?.current;
            container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
        prevSearchQueryRef.current = searchQuery;
    }, [searchQuery, scrollContainerRef]);

    const recipes = data || [];
    // Tags feed this search silently (see useRecipeSearch) — no chip filter or other tag UI here;
    // AI tagging yields 4-8 tags per recipe, too many to render as a filter row.
    const searchResults = useRecipeSearch(recipes, searchQuery);

    if (!user?.id) {
        logger.warn('Recipes page accessed without user');
        return <div>User not available</div>;
    }

    const handleRecipeClick = (recipeId: string) => {
        navigate(`/recipes/${recipeId}`);
    };

    const searchBar = (
        <PinnedSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search recipes..."
            name="recipe-search"
        />
    );

    const pageContent = (
        <div className="flex flex-col min-h-full justify-between">
            {searchQuery.trim() ? (
                <div>
                    <h2 className="text-lg font-semibold mb-3 text-foreground">Results ({searchResults.length})</h2>
                    {searchResults.length > 0 ? (
                        // Best match rendered last so it lands visually closest to the
                        // bottom-pinned search field (results "build upward" toward it).
                        <RecipesList
                            recipes={[...searchResults].reverse()}
                            currentUserId={user.id}
                            onRecipeClick={handleRecipeClick}
                        />
                    ) : (
                        <Empty className="flex-none justify-start p-4">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Search />
                                </EmptyMedia>
                                <EmptyTitle>No recipes found</EmptyTitle>
                                <EmptyDescription>Try a different search term</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </div>
            ) : (
                <div className="flex flex-col space-y-6">
                    {searchResults.length > 0 ? (
                        <RecipesList
                            recipes={searchResults}
                            currentUserId={user.id}
                            onRecipeClick={handleRecipeClick}
                        />
                    ) : (
                        <Empty className="flex-none justify-start p-4">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <ChefHat />
                                </EmptyMedia>
                                <EmptyTitle>No recipes yet</EmptyTitle>
                                <EmptyDescription>
                                    Create your first recipe, or ask a friend to share one with you
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </div>
            )}
            {searchBar}
        </div>
    );

    const errorPageContent = (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex items-center gap-3 text-destructive mb-3">
                <AlertTriangle className="h-6 w-6" />
                <span className="font-semibold">Unable to load your recipes</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-sm">Please check your connection and try again.</p>
            <Button
                variant="default"
                onClick={() => {
                    void refetch();
                }}
            >
                Retry
            </Button>
        </div>
    );

    return (
        <>
            {isError && errorPageContent}
            {isLoading && <ListsSkeleton />}
            {!isLoading && !isError && pageContent}

            <ToolBar placeholder="Enter recipe name..." />
        </>
    );
};

export default RecipesPage;
