import type { DiscoveryFacetBucket, DiscoveryFacets, RecipeDifficulty } from '@tandra/types';
import type { ReactNode } from 'react';

import type { DiscoverySearch, DiscoveryTimeFilter } from '../../hooks/useDiscoverySearch';

const MAX_CHIPS = 12;

const TIME_LABEL: Record<string, string> = {
    'under-15': 'Under 15 min',
    '15-30': '15-30 min',
    '30-60': '30-60 min',
    '60-120': '1-2 hours',
    'over-120': 'Over 2 hours',
};

const DIFFICULTY_ORDER: RecipeDifficulty[] = ['easy', 'medium', 'hard'];

const Chip = ({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
}) => (
    <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/40'
        }`}
    >
        <span>{label}</span>
        {count !== undefined && <span className={active ? 'opacity-80' : 'text-muted-foreground'}>{count}</span>}
    </button>
);

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
    <fieldset className="space-y-1.5">
        <legend className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</legend>
        <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
);

// Selected values stay visible even when the facet counts no longer list them, so they can always be unselected.
const withSelected = (buckets: DiscoveryFacetBucket[], selected: string[]): DiscoveryFacetBucket[] => {
    const shown = buckets.slice(0, MAX_CHIPS);
    const missing = selected.filter((key) => !shown.some((bucket) => bucket.key === key));
    return [...missing.map((key) => ({ key, count: 0 })), ...shown];
};

const difficultyBuckets = (facets: DiscoveryFacets): DiscoveryFacetBucket[] =>
    DIFFICULTY_ORDER.flatMap((level) => facets.difficulty.filter((bucket) => bucket.key === level));

// Empty time ranges are hidden unless selected: a "0" chip is a dead end.
const timeBuckets = (facets: DiscoveryFacets, selected: DiscoveryTimeFilter | null) =>
    facets.time.filter((bucket) => bucket.count > 0 || bucket.key === selected?.key);

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Four facet groups, each a list of chips; the branching is only "is this one selected".
// fallow-ignore-next-line complexity
export const FilterPanel = ({ search, facets }: { search: DiscoverySearch; facets: DiscoveryFacets }) => (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-3" data-testid="discover-filters">
        <Group title="Difficulty">
            {difficultyBuckets(facets).map((bucket) => (
                <Chip
                    key={bucket.key}
                    label={capitalised(bucket.key)}
                    count={bucket.count}
                    active={search.filters.difficulty.includes(bucket.key as RecipeDifficulty)}
                    onClick={() => search.toggleDifficulty(bucket.key as RecipeDifficulty)}
                />
            ))}
        </Group>
        <Group title="Total time">
            {timeBuckets(facets, search.filters.time).map((bucket) => (
                <Chip
                    key={bucket.key}
                    label={TIME_LABEL[bucket.key] ?? bucket.key}
                    count={bucket.count}
                    active={search.filters.time?.key === bucket.key}
                    onClick={() => search.toggleTime({ key: bucket.key, from: bucket.from, to: bucket.to })}
                />
            ))}
        </Group>
        <Group title="Tags">
            {withSelected(facets.tags, search.filters.tags).map((bucket) => (
                <Chip
                    key={bucket.key}
                    label={bucket.key}
                    count={bucket.count || undefined}
                    active={search.filters.tags.includes(bucket.key)}
                    onClick={() => search.toggleTag(bucket.key)}
                />
            ))}
        </Group>
        <Group title="Ingredients">
            {withSelected(facets.ingredients, search.filters.ingredients).map((bucket) => (
                <Chip
                    key={bucket.key}
                    label={bucket.key}
                    count={bucket.count || undefined}
                    active={search.filters.ingredients.includes(bucket.key)}
                    onClick={() => search.toggleIngredient(bucket.key)}
                />
            ))}
        </Group>
    </div>
);
