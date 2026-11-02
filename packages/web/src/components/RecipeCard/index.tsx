import type { Recipe } from '@tandra/types';
import { CalendarDays, Clock, Flame, ImageOff, ListChecks, Utensils } from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuthedImage } from '../../hooks/useAuthedImage';
import { AvatarStack } from '../ui/avatar-stack';
import { Skeleton } from '../ui/skeleton';

interface RecipeCardProps {
    recipe: Recipe;
    currentUserId: string;
    onClick: () => void;
}

const NEW_RECIPE_THRESHOLD_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RELATIVE_DATE_STEPS: Array<{ upToDays: number; format: (days: number) => string }> = [
    { upToDays: 0, format: () => 'Today' },
    { upToDays: 1, format: () => 'Yesterday' },
    { upToDays: 6, format: (days) => `${days}d ago` },
    { upToDays: 29, format: (days) => `${Math.round(days / 7)}w ago` },
];

const relativeDate = (dateAdded: Date): string => {
    const daysAgo = Math.floor((Date.now() - new Date(dateAdded).getTime()) / MS_PER_DAY);
    const step = RELATIVE_DATE_STEPS.find(({ upToDays }) => daysAgo <= upToDays);
    return step ? step.format(daysAgo) : `${Math.round(daysAgo / 30)}mo ago`;
};

const isRecentlyAdded = (dateAdded: Date): boolean =>
    Date.now() - new Date(dateAdded).getTime() < NEW_RECIPE_THRESHOLD_DAYS * MS_PER_DAY;

const handleActivationKey = (e: React.KeyboardEvent, onClick: () => void): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onClick();
};

const RecipeCardImage = ({ recipe }: { recipe: Recipe }) => {
    const { imageUrl, hasError } = useAuthedImage(recipe.coverImageKey);

    let content: React.ReactNode;
    if (hasError) {
        content = (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 text-muted-foreground">
                <ImageOff className="h-6 w-6" />
            </div>
        );
    } else if (imageUrl) {
        content = <img src={imageUrl} alt={recipe.title} className="h-full w-full object-cover" />;
    } else {
        content = <Skeleton className="absolute inset-0 h-full w-full rounded-none" />;
    }

    return <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-muted">{content}</div>;
};

const ingredientSummary = (recipe: Recipe): string => {
    const count = recipe.ingredients?.length ?? 0;
    return `${count} ${count === 1 ? 'ingredient' : 'ingredients'}`;
};
export const MetaChip = ({ icon: Icon, children }: { icon: typeof ListChecks; children: ReactNode }) => (
    <span className="inline-flex items-center gap-1">
        <Icon className="h-3.5 w-3.5" />
        {children}
    </span>
);

export const optionalTimeChip = (
    minutes: number | undefined,
    icon: typeof ListChecks,
    suffix: string
): { icon: typeof ListChecks; text: string } | null => {
    if (minutes === undefined) return null;
    return { icon, text: `${minutes}m ${suffix}` };
};

export const optionalServingsChip = (
    servings: number | undefined
): { icon: typeof ListChecks; text: string } | null => {
    if (servings === undefined) return null;
    return {
        icon: Utensils,
        text: `${servings} ${servings === 1 ? 'serving' : 'servings'}`,
    };
};

const recipeMetaChips = (recipe: Recipe): Array<{ icon: typeof ListChecks; text: string }> => {
    const chips = [
        { icon: ListChecks as typeof ListChecks, text: ingredientSummary(recipe) },
        { icon: CalendarDays as typeof ListChecks, text: relativeDate(recipe.dateAdded) },
        optionalTimeChip(recipe.prepTime, Clock, 'prep'),
        optionalTimeChip(recipe.cookTime, Flame, 'cook'),
        optionalServingsChip(recipe.servings),
    ];
    return chips.filter((c): c is { icon: typeof ListChecks; text: string } => c !== null);
};

const NewBadge = () => (
    <span className="absolute -top-2 -left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
        New
    </span>
);

export const RecipeCard = ({ recipe, currentUserId, onClick }: RecipeCardProps) => {
    const otherUsers = recipe.users.filter((user) => user.id !== currentUserId);

    return (
        <div
            role="button"
            onClick={onClick}
            className="group relative flex cursor-pointer gap-3 rounded-2xl border border-border bg-card p-3 transition-colors active:bg-muted/50 hover:border-primary/40"
            tabIndex={0}
            onKeyDown={(e) => handleActivationKey(e, onClick)}
        >
            {isRecentlyAdded(recipe.dateAdded) && <NewBadge />}

            <RecipeCardImage recipe={recipe} />

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-0.5">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                    {recipe.title}
                </h3>
                <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground">
                    {recipeMetaChips(recipe).map((chip) => (
                        <MetaChip key={chip.text} icon={chip.icon}>
                            {chip.text}
                        </MetaChip>
                    ))}
                </div>
                <AvatarStack users={otherUsers} />
            </div>
        </div>
    );
};
