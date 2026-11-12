import { ListType } from '@tandra/types';

import { ItemCheckBoxCard } from '../../components/ItemCheckBox/ItemCheckBoxCard';
import { SwipeRevealShell } from '../../components/SwipeRevealShell';
import { useItemImage } from '../../hooks/useItemImage';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import type { Ingredient } from './IngredientsField';

export interface DraftIngredientRowProps {
    ingredient: Ingredient;
    onEdit: () => void;
    onDelete: () => void;
}

const noop = () => {};

// Swipe-reveal edit/delete shell for draft (not-yet-persisted) recipe ingredients: reuses
// the shopping list's ItemCheckBoxCard for the image/name/quantity presentation (same feel,
// same image lookup by name) but edit/delete are local callbacks, not useItemMutations —
// recipe ingredients are draft-only local state until the whole recipe is submitted.
export const DraftIngredientRow = ({ ingredient, onEdit, onDelete }: DraftIngredientRowProps) => {
    const { x, controls, swipeState, handleDragEnd, closeSwipe } = useSwipeGesture();
    const { imageBlobUrl, hasLoadedImage, hasImageError, onImageLoad, onImageError } = useItemImage(ingredient.name);

    return (
        <SwipeRevealShell
            x={x}
            controls={controls}
            swipeState={swipeState}
            onDragEnd={handleDragEnd}
            onCloseSwipe={closeSwipe}
            onDelete={onDelete}
            onEdit={onEdit}
            deleteAriaLabel={`Delete ${ingredient.name}`}
            editAriaLabel={`Edit ${ingredient.name}`}
        >
            <ItemCheckBoxCard
                item={ingredient}
                listType={ListType.SHOPPING}
                imageBlobUrl={imageBlobUrl}
                hasLoadedImage={hasLoadedImage}
                hasImageError={hasImageError}
                isLoading={false}
                isSelected={false}
                onToggle={noop}
                onImageLoad={onImageLoad}
                onImageError={onImageError}
            />
        </SwipeRevealShell>
    );
};
