import { Recycle } from 'lucide-react';

import { RecipeResultCard } from '../../components/RecipeResultCard';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import type { IngredientWasteMatch } from '../../hooks/useIngredientWasteSearch';

interface WasteMatchResultsProps {
    query: string;
    matches: IngredientWasteMatch[];
    onSelect: (recipeId: string) => void;
}

const EmptyResults = ({ query }: { query: string }) => (
    <Empty className="flex-none justify-start p-4">
        <EmptyHeader>
            <EmptyMedia variant="icon">
                <Recycle />
            </EmptyMedia>
            <EmptyTitle>{query ? 'No matching recipes' : 'Nothing going to waste yet'}</EmptyTitle>
            <EmptyDescription>
                {query
                    ? `No recipes use anything like “${query}” yet.`
                    : "Type something you don't want to waste — we'll find recipes that use it."}
            </EmptyDescription>
        </EmptyHeader>
    </Empty>
);

export const WasteMatchResults = ({ query, matches, onSelect }: WasteMatchResultsProps) => {
    const trimmed = query.trim();

    if (matches.length === 0) {
        return <EmptyResults query={trimmed} />;
    }

    return (
        <div className="space-y-2">
            {/* Best match rendered last so it lands closest to the bottom-pinned search field. */}
            {[...matches].reverse().map(({ recipe, matchedIngredientName }) => (
                <RecipeResultCard
                    key={recipe.id}
                    recipe={recipe}
                    onClick={() => onSelect(recipe.id)}
                    subtitle={
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            uses {matchedIngredientName}
                        </span>
                    }
                />
            ))}
        </div>
    );
};
