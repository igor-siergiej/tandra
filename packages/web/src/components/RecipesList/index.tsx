import type { Recipe } from '@tandra/types';

import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { RecipeCard } from '../RecipeCard';

interface RecipesListProps {
    recipes: Recipe[];
    currentUserId: string;
    onRecipeClick: (recipeId: string) => void;
    isLoading?: boolean;
}

export const RecipesList = ({ recipes, currentUserId, onRecipeClick, isLoading }: RecipesListProps) => {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 px-2 pt-2 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((value) => (
                    <Card key={value} className="overflow-hidden">
                        <CardContent className="flex gap-3 p-3">
                            <Skeleton className="h-32 w-32 flex-shrink-0 rounded-xl" />
                            <div className="flex flex-1 flex-col justify-between py-0.5">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (recipes.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="text-4xl mb-3">📖</div>
                    <p className="text-muted-foreground">No recipes yet. Create one to get started!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 px-2 pt-2 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {recipes.map((recipe) => (
                <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    currentUserId={currentUserId}
                    onClick={() => onRecipeClick(recipe.id)}
                />
            ))}
        </div>
    );
};
