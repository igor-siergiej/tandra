import type { ListType } from '@tandra/types';
import { ListType as ListTypeEnum } from '@tandra/types';
import { Circle, CircleCheck, Clock, ImageOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

import { Card, CardContent } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Skeleton } from '../../../components/ui/skeleton';
import { HandDrawnStrike } from '../../HandDrawnStrike';
import { QuantityBadge } from '../QuantityBadge';

const PENDING_MARKER_DELAY_S = 0.8;

// name/quantity/unit only, so this also covers draft (not-yet-persisted) rows like
// recipe ingredients that don't have an Item's id/isSelected/dateAdded.
interface ItemCheckBoxCardItem {
    name: string;
    quantity?: number;
    unit?: string;
}

interface ItemCheckBoxCardProps {
    item: ItemCheckBoxCardItem;
    listType: ListType;
    /** False swaps the item image for a plain check circle (guest lists). */
    showImage?: boolean;
    imageBlobUrl: string | null;
    hasLoadedImage: boolean;
    hasImageError: boolean;
    isLoading: boolean;
    isSelected: boolean;
    onToggle: () => void;
    onImageLoad: () => void;
    onImageError: () => void;
    isPending?: boolean;
}

// fallow-ignore-next-line complexity
export const ItemCheckBoxCard = ({
    item,
    listType,
    showImage = true,
    imageBlobUrl,
    hasLoadedImage,
    hasImageError,
    isLoading,
    isSelected,
    onToggle,
    onImageLoad,
    onImageError,
    isPending = false,
}: ItemCheckBoxCardProps) => {
    return (
        <Card
            className={`transition-all rounded-lg duration-200 py-0.5 px-1 cursor-pointer ${
                isSelected
                    ? 'bg-primary/10 border-primary/20 shadow-md'
                    : 'bg-background hover:bg-accent/50 border-border'
            } ${isLoading ? 'pointer-events-none' : ''}`}
            onClick={onToggle}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
            }}
        >
            <CardContent className="flex items-center justify-between p-0.5">
                <div className="flex items-center gap-4 flex-1">
                    {showImage ? (
                        <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
                            {imageBlobUrl && (
                                <img
                                    src={imageBlobUrl}
                                    alt={item.name}
                                    className={`h-12 w-12 rounded-full object-cover border ${hasLoadedImage && !hasImageError ? 'opacity-100' : 'opacity-0'}`}
                                    onLoad={onImageLoad}
                                    onError={onImageError}
                                />
                            )}

                            {!hasLoadedImage && !hasImageError && (
                                <Skeleton className="absolute inset-0 h-12 w-12 rounded-full border" />
                            )}

                            {isLoading && (
                                <motion.div
                                    className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-full"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </motion.div>
                            )}

                            {hasImageError && (
                                <div className="absolute inset-0 h-12 w-12 rounded-full border flex items-center justify-center bg-muted/20 text-muted-foreground">
                                    <ImageOff className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                    ) : (
                        // Same row height as the image slot so guest and signed-in lists line up.
                        <div
                            className="h-12 w-10 shrink-0 flex items-center justify-center"
                            data-testid="item-check"
                            aria-hidden="true"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            ) : isSelected ? (
                                <CircleCheck className="h-6 w-6 text-primary" />
                            ) : (
                                <Circle className="h-6 w-6 text-muted-foreground" />
                            )}
                        </div>
                    )}

                    <Label
                        className={`flex-1 cursor-pointer text-base transition-all duration-300 ${isSelected ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                        <HandDrawnStrike struck={isSelected}>{item.name}</HandDrawnStrike>
                    </Label>

                    {isPending && (
                        // Delayed fade-in: online, a queued intent drains within a blink and the marker
                        // would flash on every tap; it only becomes visible if the sync is actually stuck.
                        <motion.span
                            data-testid="item-pending"
                            role="img"
                            aria-label="Waiting to sync"
                            title="Waiting to sync"
                            className="shrink-0 text-muted-foreground"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: PENDING_MARKER_DELAY_S }}
                        >
                            <Clock className="h-4 w-4" />
                        </motion.span>
                    )}
                </div>

                {listType === ListTypeEnum.SHOPPING && <QuantityBadge quantity={item.quantity} unit={item.unit} />}
            </CardContent>
        </Card>
    );
};
