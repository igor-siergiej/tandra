import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getRecipesQuery } from '../../api';
import { useUser } from '../../auth';
import { PinnedSearchField } from '../../components/PinnedSearchField';
import ToolBar from '../../components/ToolBar';
import { useIngredientWasteSearch } from '../../hooks/useIngredientWasteSearch';
import { track } from '../../utils/analytics';
import { WasteMatchResults } from './WasteMatchResults';

// Full page rather than a bottom drawer (which capped results at 60vh and put the field under
// the on-screen keyboard): same fuzzy ingredient search, but with the recipes page's
// bottom-pinned keyboard-safe field and results building upward toward it.
const UseUpIngredientPage = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');

    const { data: allRecipes = [] } = useQuery(
        user?.id ? getRecipesQuery(user.id) : { queryKey: [], queryFn: async () => [] }
    );
    const matches = useIngredientWasteSearch(allRecipes, query);

    // Fire one search event per non-empty query. Debounced to keep the
    // event count reasonable as the user types. Only the result count is sent:
    // the search text is the user's own and stays out of analytics.
    useEffect(() => {
        if (query.trim().length < 2) return;
        const t = setTimeout(() => track('useup_search', { results: matches.length }), 400);
        return () => clearTimeout(t);
    }, [query, matches.length]);

    return (
        <>
            <div className="flex flex-col min-h-full justify-between">
                <div>
                    <h2 className="text-lg font-semibold mb-3 text-foreground">Use Up an Ingredient</h2>
                    <WasteMatchResults
                        query={query}
                        matches={matches}
                        onSelect={(recipeId) => {
                            track('useup_recipe_opened', { recipeId });
                            navigate(`/recipes/${recipeId}`);
                        }}
                    />
                </div>
                <PinnedSearchField
                    value={query}
                    onChange={setQuery}
                    placeholder="e.g. spinach"
                    name="waste-warrior-search"
                />
            </div>

            <ToolBar />
        </>
    );
};

export default UseUpIngredientPage;
