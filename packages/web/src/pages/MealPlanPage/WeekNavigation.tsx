import { addDays, format } from 'date-fns';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '../../components/ui/button';

interface WeekNavigationProps {
    start: Date;
    isOnCurrentWeek: boolean;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
}

export const WeekNavigation = ({ start, isOnCurrentWeek, onPrev, onNext, onToday }: WeekNavigationProps) => {
    const rangeLabel = `${format(start, 'd MMM')} – ${format(addDays(start, 6), 'd MMM')}`;
    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="icon" aria-label="Previous week" onClick={onPrev}>
                    <ChevronLeft className="size-5" />
                </Button>
                <h2 className="text-lg font-semibold text-foreground">{rangeLabel}</h2>
                <Button variant="ghost" size="icon" aria-label="Next week" onClick={onNext}>
                    <ChevronRight className="size-5" />
                </Button>
            </div>
            {!isOnCurrentWeek && (
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToday}
                        aria-label="Jump to current week"
                        data-testid="meal-plan-today-button"
                    >
                        <CalendarRange className="mr-1 size-4" />
                        Today
                    </Button>
                </div>
            )}
        </>
    );
};
