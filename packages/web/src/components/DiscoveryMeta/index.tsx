import type { DiscoveryEstimatedField, DiscoveryRecipeSummary, RecipeDifficulty } from '@tandra/types';
import { Clock, Flame, Gauge, type ListChecks } from 'lucide-react';

import { MetaChip, optionalServingsChip, optionalTimeChip } from '../RecipeCard';

/** Prefixed to a value the extractor filled in because the source did not state it. */
const ESTIMATE_MARK = '≈';
export const ESTIMATE_LEGEND = `${ESTIMATE_MARK} estimated, not stated in the original recipe`;

const DIFFICULTY_LABEL: Record<RecipeDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

type Chip = { icon: typeof ListChecks; text: string };

// SAFETY: the icon is a lucide component; they share one props shape and typeof ListChecks only names that type.
const optionalDifficultyChip = (difficulty: RecipeDifficulty | undefined): Chip | null =>
    difficulty ? { icon: Gauge as typeof ListChecks, text: DIFFICULTY_LABEL[difficulty] } : null;

type Meta = Pick<DiscoveryRecipeSummary, 'prepTime' | 'cookTime' | 'servings' | 'difficulty' | 'estimated'>;

// One chip per stated field, each tagged with whether its value was estimated rather than read from the source.
const metaChips = (recipe: Meta): Array<{ chip: Chip; estimated: boolean }> => {
    const estimatedFields = new Set<DiscoveryEstimatedField>(recipe.estimated ?? []);

    const candidates: Array<[Chip | null, DiscoveryEstimatedField]> = [
        [optionalTimeChip(recipe.prepTime, Clock, 'prep'), 'prepTime'],
        [optionalTimeChip(recipe.cookTime, Flame, 'cook'), 'cookTime'],
        [optionalServingsChip(recipe.servings), 'servings'],
        [optionalDifficultyChip(recipe.difficulty), 'difficulty'],
    ];

    return candidates.flatMap(([chip, field]) => (chip ? [{ chip, estimated: estimatedFields.has(field) }] : []));
};

/** True when any shown value is an estimate, i.e. when the page should explain the `≈` mark. */
export const hasEstimates = (recipe: Pick<DiscoveryRecipeSummary, 'estimated'>): boolean =>
    (recipe.estimated?.length ?? 0) > 0;

/** Time / servings / difficulty chips in the same look as RecipeCard, with estimated values visibly marked. */
export const DiscoveryMeta = ({ recipe }: { recipe: Meta }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {metaChips(recipe).map(({ chip, estimated }) => (
            <span key={chip.text} title={estimated ? 'Estimated, not stated in the original recipe' : undefined}>
                <MetaChip icon={chip.icon}>{estimated ? `${ESTIMATE_MARK}${chip.text}` : chip.text}</MetaChip>
            </span>
        ))}
    </div>
);
