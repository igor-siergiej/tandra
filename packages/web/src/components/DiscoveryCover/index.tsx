import { ImageOff } from 'lucide-react';

import { useAuthedImage } from '../../hooks/useAuthedImage';
import { Skeleton } from '../ui/skeleton';

interface DiscoveryCoverProps {
    imageKey: string | undefined;
    title: string;
    className: string;
}

/** A library recipe's cover. Renders nothing when the recipe has none (Wikibooks recipes never do). */
export const DiscoveryCover = ({ imageKey, title, className }: DiscoveryCoverProps) => {
    const { imageUrl, hasError } = useAuthedImage(imageKey);

    if (!imageKey) return null;

    let content: React.ReactNode;

    if (hasError) {
        content = (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 text-muted-foreground">
                <ImageOff className="h-5 w-5" />
            </div>
        );
    } else if (imageUrl) {
        content = <img src={imageUrl} alt={title} className="h-full w-full object-cover" />;
    } else {
        content = <Skeleton className="absolute inset-0 h-full w-full rounded-none" />;
    }

    return <div className={`relative flex-shrink-0 overflow-hidden bg-muted ${className}`}>{content}</div>;
};
