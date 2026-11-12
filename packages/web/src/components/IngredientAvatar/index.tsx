import { ImageOff } from 'lucide-react';

import { Skeleton } from '../ui/skeleton';

export interface IngredientAvatarProps {
    name: string;
    imageBlobUrl: string | null;
    hasLoadedImage: boolean;
    hasImageError: boolean;
    onImageLoad: () => void;
    onImageError: () => void;
}

// The three branches are the genuine loading/loaded/error states of an async
// image load, each independently necessary (the error overlay is
// semi-transparent, so hiding the loaded image behind it on error is a real
// requirement, not incidental nesting).
// fallow-ignore-next-line complexity
export const IngredientAvatar = ({
    name,
    imageBlobUrl,
    hasLoadedImage,
    hasImageError,
    onImageLoad,
    onImageError,
}: IngredientAvatarProps) => (
    <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
        {imageBlobUrl && (
            <img
                src={imageBlobUrl}
                alt={name}
                className={`h-12 w-12 rounded-full object-cover border ${hasLoadedImage && !hasImageError ? 'opacity-100' : 'opacity-0'}`}
                onLoad={onImageLoad}
                onError={onImageError}
            />
        )}

        {!hasLoadedImage && !hasImageError && <Skeleton className="absolute inset-0 h-12 w-12 rounded-full border" />}

        {hasImageError && (
            <div className="absolute inset-0 h-12 w-12 rounded-full border flex items-center justify-center bg-muted/20 text-muted-foreground">
                <ImageOff className="h-5 w-5" />
            </div>
        )}
    </div>
);
