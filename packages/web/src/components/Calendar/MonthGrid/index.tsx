import {
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { motion, type PanInfo } from 'motion/react';

import { DayDots } from './DayDots';

export const dayKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const SWIPE_THRESHOLD = 50;

// Combine drag distance with a fraction of fling velocity so a fast short flick still pages.
const resolveMonthSwipe = (offsetX: number, velocityX: number): -1 | 0 | 1 => {
    const effective = offsetX + velocityX / 8;

    if (effective < -SWIPE_THRESHOLD) return 1; // swipe left -> next month

    if (effective > SWIPE_THRESHOLD) return -1; // swipe right -> prev month

    return 0;
};

const getDraggedTodoId = (e: React.DragEvent): string =>
    e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('todoId');

const dayCellClassName = (inMonth: boolean, selected: boolean, schedulingActive: boolean): string => {
    const colorClass = inMonth ? 'text-foreground' : 'text-muted-foreground/40';
    const bgClass = selected ? 'bg-primary text-primary-foreground' : 'bg-muted/40';
    const schedulingClass = schedulingActive ? 'ring-1 ring-primary/40' : '';

    return `aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative ${colorClass} ${bgClass} ${schedulingClass}`;
};

export interface DayDot {
    color: string;
    dimmed: boolean;
}

export interface MonthGridProps {
    month: Date;
    dotsByDay: Record<string, DayDot[]>; // dayKey -> dots
    selectedDay: Date | undefined;
    onSelectDay: (day: Date) => void;
    onDropTodoOnDay: (todoId: string, day: Date) => void;
    onChangeMonth?: (direction: -1 | 1) => void;
    schedulingActive?: boolean;
}

interface DayCellProps {
    day: Date;
    dots: DayDot[];
    selected: boolean;
    inMonth: boolean;
    schedulingActive: boolean;
    onSelect: () => void;
    onDrop: (id: string) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DayCell = ({ day, dots, selected, inMonth, schedulingActive, onSelect, onDrop }: DayCellProps) => {
    const key = dayKey(day);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const id = getDraggedTodoId(e);

        if (id) onDrop(id);
    };

    return (
        <button
            type="button"
            key={key}
            data-testid={`day-${key}`}
            onClick={onSelect}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={dayCellClassName(inMonth, selected, schedulingActive)}
        >
            <span>{day.getDate()}</span>
            <DayDots dots={dots} dayKeyPrefix={key} selected={selected} />
        </button>
    );
};

export const MonthGrid = ({
    month,
    dotsByDay,
    selectedDay,
    onSelectDay,
    onDropTodoOnDay,
    onChangeMonth,
    schedulingActive = false,
}: MonthGridProps) => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const direction = resolveMonthSwipe(info.offset.x, info.velocity.x);

        if (direction !== 0) onChangeMonth?.(direction);
    };

    return (
        <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((d, i) => (
                    <div key={`weekday-${i}-${d}`} className="text-center text-xs text-muted-foreground">
                        {d}
                    </div>
                ))}
            </div>
            <motion.div
                key={format(month, 'yyyy-MM')}
                drag={onChangeMonth ? 'x' : false}
                dragSnapToOrigin
                dragElastic={0.2}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-7 gap-1 touch-pan-y"
            >
                {days.map((day) => {
                    const key = dayKey(day);

                    return (
                        <DayCell
                            key={key}
                            day={day}
                            dots={dotsByDay[key] ?? []}
                            selected={selectedDay ? isSameDay(day, selectedDay) : false}
                            inMonth={isSameMonth(day, month)}
                            schedulingActive={schedulingActive}
                            onSelect={() => onSelectDay(day)}
                            onDrop={(id) => onDropTodoOnDay(id, day)}
                        />
                    );
                })}
            </motion.div>
        </div>
    );
};
