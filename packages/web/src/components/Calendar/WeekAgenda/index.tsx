import type { Label } from '@tandra/types';
import { format } from 'date-fns';

import type { AgendaDay } from '../../../utils/calendar';
import { DayTodoList, type TodoRowHandlers } from '../DayTodoList';

export interface WeekAgendaProps extends TodoRowHandlers {
    days: AgendaDay[];
    labels: Label[];
    schedulingTodoId?: string | null;
    onScheduleDay?: (day: Date) => void;
}

export const WeekAgenda = ({ days, labels, schedulingTodoId, onScheduleDay, ...handlers }: WeekAgendaProps) => {
    const withItems = days.filter((d) => d.items.length > 0);
    const scheduling = Boolean(schedulingTodoId);

    // While scheduling, every day (not just ones with existing items) is a valid drop target.
    const visibleDays = scheduling ? days : withItems;

    if (visibleDays.length === 0) {
        return <p className="text-sm text-muted-foreground py-6 text-center">No upcoming todos this week</p>;
    }

    return (
        <div className="space-y-3 pb-44">
            {visibleDays.map(({ day, items }) => (
                <div key={day.toISOString()}>
                    {scheduling ? (
                        <button
                            type="button"
                            data-testid={`week-day-${format(day, 'yyyy-MM-dd')}`}
                            onClick={() => onScheduleDay?.(day)}
                            className="w-full rounded-md py-0.5 text-left text-sm font-medium text-primary ring-1 ring-primary/40"
                        >
                            {format(day, 'EEE d MMM')}
                        </button>
                    ) : (
                        <h3 className="text-sm font-medium text-muted-foreground">{format(day, 'EEE d MMM')}</h3>
                    )}
                    <DayTodoList items={items} labels={labels} {...handlers} />
                </div>
            ))}
        </div>
    );
};
