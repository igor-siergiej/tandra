import type { Recipe } from '@tandra/types';
import { ImageIcon, ImageOff, Sparkles } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { revertRecipeAiImage, uploadRecipeImage } from '../../api';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthedImage } from '../../hooks/useAuthedImage';
import { notifyError, notifySuccess } from '../../utils/toast';

interface CoverImageSectionProps {
    recipe: Recipe;
    isOwner?: boolean;
    isEditing?: boolean;
    onImageChange?: () => void;
}

const useImageAction = (onImageChange?: () => void) => {
    const [isBusy, setIsBusy] = useState(false);

    const run = async (action: () => Promise<unknown>, success: string, fallbackError: string) => {
        setIsBusy(true);

        try {
            await action();
            notifySuccess(success);
            onImageChange?.();
        } catch (err) {
            notifyError(err instanceof Error ? err.message : fallbackError);
        } finally {
            setIsBusy(false);
        }
    };

    return { isBusy, run };
};

const CoverImagePreview = ({
    imageUrl,
    showSkeleton,
    hasError,
    alt,
}: {
    imageUrl: string | null;
    showSkeleton: boolean;
    hasError: boolean;
    alt: string;
}) => {
    if (hasError) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm">Failed to load image</p>
            </div>
        );
    }

    if (imageUrl) {
        return <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />;
    }

    if (showSkeleton) {
        return <Skeleton className="absolute inset-0 h-full w-full rounded-none" />;
    }

    return null;
};

type ImageAction = ReturnType<typeof useImageAction>;

const RevertButton = ({ recipe, isBusy, run }: { recipe: Recipe } & ImageAction) => {
    if (!recipe.aiImageKey || recipe.coverImageKey === recipe.aiImageKey) return null;

    return (
        <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => run(() => revertRecipeAiImage(recipe.id), 'Reverted to AI image', 'Failed to revert image')}
        >
            <Sparkles className="h-4 w-4 mr-1" />
            Use AI image
        </Button>
    );
};

const UploadButton = ({ recipe, isBusy, run }: { recipe: Recipe } & ImageAction) => {
    const fileInputId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file) return;
        await run(() => uploadRecipeImage(recipe.id, file), 'Image uploaded successfully', 'Failed to upload image');
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                onClick={(e) => {
                    (e.currentTarget as HTMLInputElement).value = '';
                }}
                disabled={isBusy}
                className="hidden"
                id={fileInputId}
            />
            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
            >
                <ImageIcon className="h-4 w-4 mr-1" />
                {recipe.coverImageKey ? 'Replace' : 'Upload'}
            </Button>
        </>
    );
};

const OwnerControls = ({ recipe, onImageChange }: { recipe: Recipe; onImageChange?: () => void }) => {
    const action = useImageAction(onImageChange);

    return (
        <div className="absolute bottom-3 right-3 z-10 flex gap-2">
            <RevertButton recipe={recipe} {...action} />
            <UploadButton recipe={recipe} {...action} />
        </div>
    );
};

export const CoverImageSection = ({
    recipe,
    isOwner = false,
    isEditing = false,
    onImageChange,
}: CoverImageSectionProps) => {
    const { imageUrl, isLoading, hasError } = useAuthedImage(recipe.coverImageKey);

    return (
        <div className="relative h-64 w-full rounded-md overflow-hidden bg-muted border flex items-center justify-center">
            <CoverImagePreview
                imageUrl={imageUrl}
                showSkeleton={isLoading || !recipe.coverImageKey}
                hasError={hasError}
                alt={recipe.title}
            />
            {isOwner && isEditing && <OwnerControls recipe={recipe} onImageChange={onImageChange} />}
        </div>
    );
};
