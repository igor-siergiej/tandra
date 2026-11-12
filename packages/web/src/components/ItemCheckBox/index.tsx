import { type Item, type ItemCategory, type ListType, ListType as ListTypeEnum } from '@tandra/types';
import { motion } from 'motion/react';
import { type MouseEvent, useId, useRef, useState } from 'react';

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
import { useItemEditDrawer } from '../../hooks/useItemEditDrawer';
import { useItemImage } from '../../hooks/useItemImage';
import { useItemMutations } from '../../hooks/useItemMutations';
import { usePendingItemIds } from '../../hooks/usePendingItemIds';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { AisleSelect } from '../AisleSelect';
import { SwipeRevealShell } from '../SwipeRevealShell';
import { ItemCheckBoxCard } from './ItemCheckBoxCard';

interface ItemCheckBoxProps {
    item: Item;
    listTitle: string;
    listType: ListType;
    showImage: boolean;
}

// One row: swipe, edit drawer and mutations share state, so they stay in one component.
// fallow-ignore-next-line complexity
const ItemCheckBox = ({ item, listTitle, listType, showImage }: ItemCheckBoxProps) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const drawerInputRef = useRef<HTMLInputElement>(null);
    const itemNameId = useId();
    const itemQuantityId = useId();
    const itemUnitId = useId();

    const { imageBlobUrl, hasLoadedImage, hasImageError, onImageLoad, onImageError } = useItemImage(
        showImage ? item.name : null
    );

    const { toggleMutation, deleteMutation, updateNameMutation, updateQuantityMutation, updateCategoryMutation } =
        useItemMutations(listTitle, item.id);

    const drawerState = useItemEditDrawer();
    const isPending = usePendingItemIds(listTitle).has(item.id);

    const handleDeleteItem = async (e?: MouseEvent) => {
        e?.stopPropagation();
        setIsDeleting(true);
        deleteMutation.mutate();
    };

    const { x, controls, swipeState, handleDragEnd, closeSwipe } = useSwipeGesture();

    const handleEditStart = (e?: MouseEvent) => {
        e?.stopPropagation();
        closeSwipe();
        void controls.start({ x: 0 });
        drawerState.openDrawer({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
        });
        setTimeout(() => {
            drawerInputRef.current?.focus();
        }, 250);
    };

    const handleToggleSelected = async () => {
        if (toggleMutation.isPending || swipeState !== 'closed') return;
        const next = !item.isSelected;
        toggleMutation.mutate(next);
    };

    // fallow-ignore-next-line complexity
    const handleDrawerSave = () => {
        const { values } = drawerState;
        const hasNameChange = values.name.trim() && values.name !== item.name;
        const newQuantity = values.quantity.trim() ? parseFloat(values.quantity) : undefined;
        const newUnit = values.unit.trim() || undefined;
        const hasQuantityChange = newQuantity !== item.quantity || newUnit !== item.unit;

        if (hasNameChange) updateNameMutation.mutate(values.name.trim());

        if (hasQuantityChange) updateQuantityMutation.mutate({ quantity: newQuantity, unit: newUnit });

        if (values.category && values.category !== (item.category ?? '')) {
            updateCategoryMutation.mutate(values.category as ItemCategory);
        }

        drawerState.closeDrawer();
    };

    return (
        <>
            <motion.div
                layout
                className="relative mb-2 rounded-lg overflow-hidden"
                initial={{ opacity: 1, scale: 1, height: 'auto' }}
                animate={
                    isDeleting
                        ? { opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }
                        : { opacity: 1, scale: item.isSelected ? 0.97 : 1, height: 'auto' }
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
                    onDelete={handleDeleteItem}
                    onEdit={handleEditStart}
                    deleteLoading={deleteMutation.isPending}
                    disabled={deleteMutation.isPending}
                    hideActions={isDeleting}
                    deleteAriaLabel={`Delete ${item.name}`}
                    editAriaLabel={`Edit ${item.name}`}
                >
                    <motion.div
                        animate={{ opacity: toggleMutation.isPending ? 0.5 : 1 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                        <ItemCheckBoxCard
                            item={item}
                            listType={listType}
                            showImage={showImage}
                            imageBlobUrl={imageBlobUrl}
                            hasLoadedImage={hasLoadedImage}
                            hasImageError={hasImageError}
                            isLoading={toggleMutation.isPending}
                            isSelected={item.isSelected}
                            isPending={isPending}
                            onToggle={handleToggleSelected}
                            onImageLoad={onImageLoad}
                            onImageError={onImageError}
                        />
                    </motion.div>
                </SwipeRevealShell>
            </motion.div>

            <Drawer open={drawerState.isOpen} onOpenChange={(open) => !open && drawerState.closeDrawer()}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-sm">
                        <DrawerHeader>
                            <DrawerTitle>Edit Item</DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 space-y-4">
                            <div>
                                <Label htmlFor={itemNameId}>Item Name</Label>
                                <Input
                                    id={itemNameId}
                                    ref={drawerInputRef}
                                    value={drawerState.values.name}
                                    purpose="name"
                                    onChange={(e) => drawerState.updateName(e.target.value)}
                                    placeholder="Enter item name"
                                    className="mt-2"
                                />
                            </div>

                            {listType === ListTypeEnum.SHOPPING && (
                                <AisleSelect
                                    value={drawerState.values.category}
                                    onChange={drawerState.updateCategory}
                                />
                            )}

                            {listType === ListTypeEnum.SHOPPING && (
                                <QuantityUnitField
                                    quantity={drawerState.values.quantity}
                                    unit={drawerState.values.unit}
                                    onQuantityChange={drawerState.updateQuantity}
                                    onUnitChange={drawerState.updateUnit}
                                    quantityId={itemQuantityId}
                                    unitId={itemUnitId}
                                />
                            )}
                        </div>
                        <DrawerFooter>
                            <Button onClick={handleDrawerSave} disabled={!drawerState.values.name.trim()}>
                                Save Changes
                            </Button>
                            <DrawerClose asChild>
                                <Button variant="outline" onClick={() => drawerState.closeDrawer()}>
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

export default ItemCheckBox;
