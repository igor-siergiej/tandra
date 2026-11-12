import type { Ingredient } from '@tandra/types';

import { useItemImage } from '../../hooks/useItemImage';
import { IngredientAvatar } from '../IngredientAvatar';

interface IngredientSelectRowProps {
    ingredient: Ingredient;
    isSelected: boolean;
    onToggle: (id: string) => void;
}

export const IngredientSelectRow = ({ ingredient, isSelected, onToggle }: IngredientSelectRowProps) => {
    const { imageBlobUrl, hasLoadedImage, hasImageError, onImageLoad, onImageError } = useItemImage(ingredient.name);

    return (
        <button
            type="button"
            onClick={() => onToggle(ingredient.id)}
            className={`flex items-center gap-4 p-3 rounded-lg border transition-all text-left w-full ${
                isSelected
                    ? 'bg-primary/10 border-primary/20 text-foreground'
                    : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground line-through'
            }`}
        >
            <IngredientAvatar
                name={ingredient.name}
                imageBlobUrl={imageBlobUrl}
                hasLoadedImage={hasLoadedImage}
                hasImageError={hasImageError}
                onImageLoad={onImageLoad}
                onImageError={onImageError}
            />

            <div>
                <div className="font-medium">{ingredient.name}</div>
                {(ingredient.quantity !== undefined || ingredient.unit) && (
                    <div className="text-sm mt-1">
                        {ingredient.quantity} {ingredient.unit}
                    </div>
                )}
            </div>
        </button>
    );
};
