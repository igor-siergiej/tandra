import type { Ingredient } from '@tandra/types';
import { motion } from 'motion/react';
import { type MouseEvent, useId, useRef, useState } from 'react';

import { QuantityBadge } from '../../components/ItemCheckBox/QuantityBadge';
import { QuantityUnitField } from '../../components/QuantityUnitField';
import { Button } from '../../components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '../../components/ui/drawer';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useItemImage } from '../../hooks/useItemImage';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { IngredientAvatar } from '../IngredientAvatar';
import { IngredientSubstitutesPopover } from '../IngredientSubstitutesPopover';
import { SwipeRevealShell } from '../SwipeRevealShell';

interface IngredientItemProps {
    ingredient: Ingredient;
    onDelete: (id: string) => void;
    onEdit: (id: string, updated: Ingredient) => void;
    isOwner?: boolean;
    recipeTitle?: string;
}

interface IngredientRowContentProps {
    ingredient: Ingredient;
    imageBlobUrl: string | null;
    hasLoadedImage: boolean;
    hasImageError: boolean;
    onImageLoad: () => void;
    onImageError: () => void;
    recipeTitle?: string;
    muted?: boolean;
}

// Shared avatar/name/quantity/substitutes row, identical for the read-only (non-owner) and
// swipeable (owner) renders below — only the surrounding wrapper (plain div vs SwipeRevealShell)
// and the muted background differ.
const IngredientRowContent = ({
    ingredient,
    imageBlobUrl,
    hasLoadedImage,
    hasImageError,
    onImageLoad,
    onImageError,
    recipeTitle,
    muted = false,
}: IngredientRowContentProps) => (
    <div
        className={`flex items-center gap-3 p-3 rounded-lg border border-border min-h-[60px] ${muted ? 'bg-muted/20' : ''}`}
    >
        <IngredientAvatar
            name={ingredient.name}
            imageBlobUrl={imageBlobUrl}
            hasLoadedImage={hasLoadedImage}
            hasImageError={hasImageError}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
        />
        <p className="font-medium flex-1">{ingredient.name}</p>
        <QuantityBadge quantity={ingredient.quantity} unit={ingredient.unit} />
        <IngredientSubstitutesPopover ingredientName={ingredient.name} recipeTitle={recipeTitle} />
    </div>
);

const IngredientItem = ({ ingredient, onDelete, onEdit, isOwner = true, recipeTitle }: IngredientItemProps) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const drawerInputRef = useRef<HTMLInputElement>(null);
    const ingredientNameId = useId();
    const ingredientQuantityId = useId();
    const ingredientUnitId = useId();

    const { imageBlobUrl, hasLoadedImage, hasImageError, onImageLoad, onImageError } = useItemImage(ingredient.name);

    const [editedName, setEditedName] = useState(ingredient.name);
    const [editedQuantity, setEditedQuantity] = useState(String(ingredient.quantity || ''));
    const [editedUnit, setEditedUnit] = useState(ingredient.unit || '');

    const handleDeleteClick = async (e?: MouseEvent) => {
        e?.stopPropagation();
        setIsDeleting(true);
        setIsLoading(true);

        try {
            // onDelete's own caller shows the error toast on failure and no toast on success
            // (see RecipeDetailPage/IngredientsSection) — this just drives the fade-out animation.
            await onDelete(ingredient.id);
        } catch {
            setIsDeleting(false);
            setIsLoading(false);
        }
    };

    const { x, controls, swipeState, handleDragEnd, closeSwipe } = useSwipeGesture();

    const handleEditClick = (e?: MouseEvent) => {
        e?.stopPropagation();
        closeSwipe();
        void controls.start({ x: 0 });
        setEditedName(ingredient.name);
        setEditedQuantity(String(ingredient.quantity || ''));
        setEditedUnit(ingredient.unit || '');
        setIsDrawerOpen(true);
        setTimeout(() => {
            drawerInputRef.current?.focus();
        }, 250);
    };

    const handleDrawerSave = () => {
        const name = editedName.trim();

        if (!name) return;

        setIsLoading(true);
        const quantity = editedQuantity.trim() ? parseFloat(editedQuantity) : undefined;
        const unit = editedUnit.trim() || undefined;

        onEdit(ingredient.id, {
            ...ingredient,
            name,
            quantity,
            unit,
        });

        setIsLoading(false);
        setIsDrawerOpen(false);
    };

    if (!isOwner) {
        return (
            <IngredientRowContent
                ingredient={ingredient}
                imageBlobUrl={imageBlobUrl}
                hasLoadedImage={hasLoadedImage}
                hasImageError={hasImageError}
                onImageLoad={onImageLoad}
                onImageError={onImageError}
                recipeTitle={recipeTitle}
                muted
            />
        );
    }

    return (
        <>
            <motion.div
                layout
                className="relative mb-2 rounded-lg overflow-hidden"
                initial={{ opacity: 1, scale: 1, height: 'auto' }}
                animate={
                    isDeleting
                        ? { opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }
                        : { opacity: 1, scale: 1, height: 'auto' }
                }
                transition={{
                    duration: 0.35,
                    ease: [0.4, 0, 0.2, 1],
                    layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                }}
            >
                <SwipeRevealShell
                    x={x}
                    controls={controls}
                    swipeState={swipeState}
                    onDragEnd={handleDragEnd}
                    onCloseSwipe={closeSwipe}
                    onDelete={handleDeleteClick}
                    onEdit={handleEditClick}
                    deleteLoading={isLoading}
                    disabled={isLoading}
                    hideActions={isDeleting}
                    deleteAriaLabel={`Delete ${ingredient.name}`}
                    editAriaLabel={`Edit ${ingredient.name}`}
                >
                    <IngredientRowContent
                        ingredient={ingredient}
                        imageBlobUrl={imageBlobUrl}
                        hasLoadedImage={hasLoadedImage}
                        hasImageError={hasImageError}
                        onImageLoad={onImageLoad}
                        onImageError={onImageError}
                        recipeTitle={recipeTitle}
                    />
                </SwipeRevealShell>
            </motion.div>

            <Drawer open={isDrawerOpen} onOpenChange={(open) => !open && setIsDrawerOpen(false)}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-sm">
                        <DrawerHeader>
                            <DrawerTitle>Edit Ingredient</DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 space-y-4">
                            <div>
                                <Label htmlFor={ingredientNameId}>Ingredient Name</Label>
                                <Input
                                    id={ingredientNameId}
                                    ref={drawerInputRef}
                                    value={editedName}
                                    purpose="name"
                                    onChange={(e) => setEditedName(e.target.value)}
                                    placeholder="Enter ingredient name"
                                    className="mt-2"
                                />
                            </div>

                            <QuantityUnitField
                                quantity={editedQuantity}
                                unit={editedUnit}
                                onQuantityChange={setEditedQuantity}
                                onUnitChange={setEditedUnit}
                                quantityId={ingredientQuantityId}
                                unitId={ingredientUnitId}
                            />
                        </div>
                        <DrawerFooter>
                            <Button onClick={handleDrawerSave} disabled={!editedName.trim()}>
                                Save Changes
                            </Button>
                            <DrawerClose asChild>
                                <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>
                                    Cancel
                                </Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
};

export default IngredientItem;
