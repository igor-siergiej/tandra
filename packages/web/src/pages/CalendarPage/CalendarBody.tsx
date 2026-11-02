import type { Label } from '@tandra/types';
import { format } from 'date-fns';

import { type DayTodoItem, DayTodoList, type TodoRowHandlers } from '../../components/Calendar/DayTodoList';
import { WeekAgenda } from '../../components/Calendar/WeekAgenda';
import type { AgendaDay } from '../../utils/calendar';
import type { CalendarView } from './CalendarHeader';

export interface CalendarBodyProps extends TodoRowHandlers {
    view: CalendarView;
    selectedDay: Date;
    selectedItems: DayTodoItem[];
    weekDays: AgendaDay[];
    labels: Label[];
    schedulingTodoId: string | null;
    onScheduleDay: (day: Date) => void;
}

export const CalendarBody = ({
    view,
    selectedDay,
    selectedItems,
    weekDays,
    labels,
    schedulingTodoId,
    onScheduleDay,
    ...handlers
}: CalendarBodyProps) => (
    <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'month' ? (
            <div className="mt-3">
                <h3 className="text-sm font-medium text-muted-foreground">{format(selectedDay, 'EEE d MMMM')}</h3>
                <DayTodoList items={selectedItems} labels={labels} {...handlers} />
            </div>
        ) : (
            <div className="mt-3">
                <WeekAgenda
                    days={weekDays}
                    labels={labels}
                    schedulingTodoId={schedulingTodoId}
                    onScheduleDay={onScheduleDay}
                    {...handlers}
                />
            </div>
        )}
    </div>
);
