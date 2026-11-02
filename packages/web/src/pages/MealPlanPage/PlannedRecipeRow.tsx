import type { MealPlanEntry } from '@tandra/types';
import { ImageOff, Utensils, X } from 'lucide-react';

import { PortionsStepper } from '../../components/PortionsStepper';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useAuthedImage } from '../../hooks/useAuthedImage';

interface PlannedRecipeRowProps {
    entry: MealPlanEntry;
    title?: string;
    coverImageKey?: string;
    canRemove: boolean;
    onServingsChange: (servings: number) => void;
    onRemove: () => void;
}

const RecipeImage = ({ imageKey, alt }: { imageKey: string; alt: string }) => {
    const { imageUrl } = useAuthedImage(imageKey);
    if (!imageUrl) return <RecipeThumbFallback hasError />;
    return (
        <img src={imageUrl} alt={alt} role="presentation" className="h-12 w-12 flex-shrink-0 rounded-md object-cover" />
    );
};

const RecipeThumbFallback = ({ hasError = false }: { hasError?: boolean }) => {
    const Icon = hasError ? ImageOff : Utensils;
    const tone = hasError ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary';
    return (
        <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md ${tone}`}
            aria-hidden="true"
        >
            <Icon className="size-5" />
        </div>
    );
};

const RecipeTitleBlock = ({ title, isAvailable }: { title: string; isAvailable: boolean }) => (
    <div className="flex flex-col">
        <span className="font-medium text-foreground">{title}</span>
        {!isAvailable && (
            <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                Recipe unavailable
            </Badge>
        )}
    </div>
);

export const PlannedRecipeRow = ({
    entry,
    title,
    coverImageKey,
    canRemove,
    onServingsChange,
    onRemove,
}: PlannedRecipeRowProps) => {
    const isAvailable = title !== undefined;
    const displayTitle = isAvailable ? title : 'Unavailable recipe';
    const removeAriaLabel = `Remove ${displayTitle}`;

    return (
        <div className="mt-2 space-y-3 rounded-md border bg-card p-3 shadow-xs" data-testid="meal-plan-planned-row">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                    {coverImageKey ? (
                        <RecipeImage imageKey={coverImageKey} alt={displayTitle} />
                    ) : (
                        <RecipeThumbFallback />
                    )}
                    <RecipeTitleBlock title={displayTitle} isAvailable={isAvailable} />
                </div>
                {canRemove && (
                    <Button variant="ghost" size="icon" aria-label={removeAriaLabel} onClick={onRemove}>
                        <X className="size-4" />
                    </Button>
                )}
            </div>
            <PortionsStepper value={entry.servings} onChange={onServingsChange} />
        </div>
    );
};
