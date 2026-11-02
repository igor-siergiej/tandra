import type { MealPlanEntry, Recipe } from '@tandra/types';
import { format } from 'date-fns';
import { CalendarDays, Plus } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { PlannedRecipeRow } from './PlannedRecipeRow';

interface MealPlanDayCardProps {
    day: Date;
    isToday: boolean;
    entries: Array<MealPlanEntry>;
    recipeById: Map<string, Recipe>;
    canRemove: (entry: MealPlanEntry) => boolean;
    onPick: (day: Date) => void;
    onServingsChange: (entry: MealPlanEntry, servings: number) => void;
    onRemove: (entry: MealPlanEntry) => void;
}

const DayHeader = ({ day, isToday, onPick }: { day: Date; isToday: boolean; onPick: (day: Date) => void }) => {
    const weekday = format(day, 'EEEE');
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
                <h3 className="text-base font-semibold text-foreground">{weekday}</h3>
                <span className="text-sm text-muted-foreground">{format(day, 'd MMM')}</span>
                {isToday && (
                    <Badge
                        variant="default"
                        className="ml-1 bg-primary text-primary-foreground"
                        data-testid="meal-plan-today-badge"
                    >
                        Today
                    </Badge>
                )}
            </div>
            <Button variant="ghost" size="sm" aria-label={`Plan a recipe for ${weekday}`} onClick={() => onPick(day)}>
                <Plus className="size-4" />
            </Button>
        </div>
    );
};

const EmptyDayHint = ({ day, isToday }: { day: Date; isToday: boolean }) => {
    const dayLabel = format(day, 'EEEE d MMM');
    const description = isToday
        ? `Add what you're cooking for ${dayLabel.toLowerCase()}.`
        : `Plan a recipe for ${dayLabel}.`;
    return (
        <Empty className="mt-2 flex-none justify-start border-dashed bg-muted/30 p-4" data-testid="meal-plan-day-empty">
            <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                    <CalendarDays />
                </EmptyMedia>
                <EmptyTitle className="text-sm">Nothing planned</EmptyTitle>
                <EmptyDescription className="text-xs">{description}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
};

export const MealPlanDayCard = ({
    day,
    isToday,
    entries,
    recipeById,
    canRemove,
    onPick,
    onServingsChange,
    onRemove,
}: MealPlanDayCardProps) => (
    <section
        aria-label={format(day, 'EEEE d MMMM')}
        data-today={isToday ? 'true' : undefined}
        className={isToday ? 'rounded-lg border-2 border-primary p-3 shadow-sm' : 'rounded-lg border p-3'}
    >
        <DayHeader day={day} isToday={isToday} onPick={onPick} />
        {entries.length === 0 ? (
            <EmptyDayHint day={day} isToday={isToday} />
        ) : (
            <div className="space-y-2">
                {entries.map((entry) => {
                    const recipe = recipeById.get(entry.recipeId);
                    return (
                        <PlannedRecipeRow
                            key={entry.id}
                            entry={entry}
                            title={recipe?.title}
                            coverImageKey={recipe?.coverImageKey}
                            canRemove={canRemove(entry)}
                            onServingsChange={(servings) => onServingsChange(entry, servings)}
                            onRemove={() => onRemove(entry)}
                        />
                    );
                })}
            </div>
        )}
    </section>
);
