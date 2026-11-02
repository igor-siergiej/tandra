import type { Recipe } from '@tandra/types';
import { ImageOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuthedImage } from '../../hooks/useAuthedImage';
import { Skeleton } from '../ui/skeleton';

interface RecipeResultCardProps {
    recipe: Recipe;
    subtitle: ReactNode;
    onClick: () => void;
}

// Uploaded covers need the bearer token, which a plain <img src> can't send, so the cover goes through
// useAuthedImage like every other recipe cover.
const RecipeResultCover = ({ imageKey, title }: { imageKey: string; title: string }) => {
    const { imageUrl, hasError } = useAuthedImage(imageKey);

    if (hasError) {
        return (
            <div className="flex w-12 h-12 flex-shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                <ImageOff className="h-4 w-4" />
            </div>
        );
    }

    if (!imageUrl) return <Skeleton className="w-12 h-12 flex-shrink-0 rounded" />;

    return <img src={imageUrl} alt={title} className="w-12 h-12 rounded object-cover flex-shrink-0" />;
};

// Shared recipe-card row (cover image + title + a caller-supplied subtitle slot) used by every
// drawer that lists recipes as tappable search results — AddFromRecipeDrawer's ingredient count,
// WasteWarriorDrawer's matched-ingredient badge — so the row layout only lives in one place.
export const RecipeResultCard = ({ recipe, subtitle, onClick }: RecipeResultCardProps) => (
    <button
        onClick={onClick}
        className="w-full p-3 rounded-lg border border-muted-foreground/20 hover:bg-muted/50 transition-colors text-left"
        type="button"
    >
        <div className="flex items-start gap-3">
            {recipe.coverImageKey && <RecipeResultCover imageKey={recipe.coverImageKey} title={recipe.title} />}
            <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{recipe.title}</h3>
                {subtitle}
            </div>
        </div>
    </button>
);
