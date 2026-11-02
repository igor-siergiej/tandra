import type { Label } from '@tandra/types';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { LabelFilter } from '../../components/Calendar/LabelFilter';
import type { DayDot } from '../../components/Calendar/MonthGrid';
import { MonthGrid } from '../../components/Calendar/MonthGrid';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export type CalendarView = 'month' | 'week';

export interface CalendarHeaderProps {
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
    month: Date;
    onChangeMonth: (direction: -1 | 1) => void;
    dotsByDay: Record<string, DayDot[]>;
    selectedDay: Date;
    onSelectDay: (day: Date) => void;
    onDropTodoOnDay: (todoId: string, day: Date) => void;
    schedulingActive: boolean;
    labels: Label[];
    activeLabels: Set<string>;
    onToggleLabel: (labelId: string) => void;
}

// SAFETY: the Select only offers the CalendarView values rendered below.
export const CalendarHeader = ({
    view,
    onViewChange,
    month,
    onChangeMonth,
    dotsByDay,
    selectedDay,
    onSelectDay,
    onDropTodoOnDay,
    schedulingActive,
    labels,
    activeLabels,
    onToggleLabel,
}: CalendarHeaderProps) => (
    <div className="shrink-0 bg-background pb-2">
        <div className="mb-2 flex items-center gap-2">
            <Select value={view} onValueChange={(v) => onViewChange(v as CalendarView)}>
                <SelectTrigger className="h-9 w-32">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                </SelectContent>
            </Select>
            {view === 'month' && (
                <div className="flex flex-1 items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onChangeMonth(-1)}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-base font-semibold">{format(month, 'MMM yyyy')}</span>
                    <Button variant="ghost" size="icon" onClick={() => onChangeMonth(1)}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            )}
        </div>

        <LabelFilter labels={labels} active={activeLabels} onToggle={onToggleLabel} />

        {view === 'month' && (
            <MonthGrid
                month={month}
                dotsByDay={dotsByDay}
                selectedDay={selectedDay}
                onSelectDay={onSelectDay}
                onDropTodoOnDay={onDropTodoOnDay}
                onChangeMonth={onChangeMonth}
                schedulingActive={schedulingActive}
            />
        )}
    </div>
);
