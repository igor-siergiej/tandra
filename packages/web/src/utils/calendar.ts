import type { Todo } from '@tandra/types';
import { addDays } from 'date-fns';

import type { DayTodoItem } from '../components/Calendar/DayTodoList';
import { type DayDot, dayKey } from '../components/Calendar/MonthGrid';
import { expandOccurrences, isoDay } from './recurrence';

interface CalendarDayData {
    dotsByDay: Record<string, DayDot[]>;
    selectedItems: DayTodoItem[];
}

export interface LabelContext {
    labelColor: Map<string, string>;
    activeLabels: Set<string>;
}

const isDimmed = (todo: Todo, activeLabels: Set<string>): boolean =>
    activeLabels.size > 0 && !(todo.labelId !== undefined && activeLabels.has(todo.labelId));

const addOccurrenceToDots = (
    dots: Record<string, DayDot[]>,
    key: string,
    color: string | undefined,
    dimmed: boolean
): void => {
    if (!dots[key]) dots[key] = [];
    dots[key].push({ color: color ?? '#3b82f6', dimmed });
};

interface CollectCtx {
    selectedKey: string;
    rangeStart: Date;
    rangeEnd: Date;
    labelColor: Map<string, string>;
    activeLabels: Set<string>;
    dots: Record<string, DayDot[]>;
    items: DayTodoItem[];
}

const collectTodo = (todo: Todo, ctx: CollectCtx): void => {
    const color = todo.labelId ? ctx.labelColor.get(todo.labelId) : undefined;
    const dimmed = isDimmed(todo, ctx.activeLabels);
    for (const occ of expandOccurrences(todo, ctx.rangeStart, ctx.rangeEnd)) {
        const key = dayKey(occ.date);
        addOccurrenceToDots(ctx.dots, key, color, dimmed);
        if (key === ctx.selectedKey) ctx.items.push(toSelectedItem(todo, color, occ.date, occ.done, dimmed));
    }
};

const ALL_DAY = 'all day';

const timeKey = (item: DayTodoItem): string => (item.time === ALL_DAY ? '' : (item.time ?? ''));

/** All-day todos lead each day; timed ones follow in clock order. */
const compareByTime = (a: DayTodoItem, b: DayTodoItem): number => timeKey(a).localeCompare(timeKey(b));

const toSelectedItem = (
    todo: Todo,
    color: string | undefined,
    occDate: Date,
    done: boolean,
    dimmed: boolean
): DayTodoItem => ({
    todoId: todo.id,
    title: todo.title,
    time: todo.time ?? ALL_DAY,
    done,
    overdue: !done && isoDay(occDate) < isoDay(new Date()),
    labelColor: color ?? 'transparent',
    dimmed,
    occurrenceDay: isoDay(occDate),
    ownerId: todo.ownerId,
    users: todo.users,
});

export const buildCalendarDayData = (
    todos: Todo[],
    _month: Date,
    selectedDay: Date,
    rangeStart: Date,
    rangeEnd: Date,
    { labelColor, activeLabels }: LabelContext
): CalendarDayData => {
    const dots: Record<string, DayDot[]> = {};
    const items: DayTodoItem[] = [];
    const ctx: CollectCtx = {
        selectedKey: dayKey(selectedDay),
        rangeStart,
        rangeEnd,
        labelColor,
        activeLabels,
        dots,
        items,
    };

    for (const todo of todos) {
        collectTodo(todo, ctx);
    }

    return { dotsByDay: dots, selectedItems: items.sort(compareByTime) };
};

export interface AgendaDay {
    day: Date;
    items: DayTodoItem[];
}

const collectWeekTodo = (
    todo: Todo,
    rangeStart: Date,
    rangeEnd: Date,
    byDay: Map<string, DayTodoItem[]>,
    { labelColor, activeLabels }: LabelContext
): void => {
    const color = todo.labelId ? labelColor.get(todo.labelId) : undefined;
    const dimmed = isDimmed(todo, activeLabels);
    for (const occ of expandOccurrences(todo, rangeStart, rangeEnd)) {
        const bucket = byDay.get(dayKey(occ.date));
        if (bucket) bucket.push(toSelectedItem(todo, color, occ.date, occ.done, dimmed));
    }
};

export const buildWeekAgenda = (todos: Todo[], start: Date, ctx: LabelContext): AgendaDay[] => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const byDay = new Map<string, DayTodoItem[]>(days.map((d) => [dayKey(d), []]));

    for (const todo of todos) {
        collectWeekTodo(todo, days[0], days[6], byDay, ctx);
    }

    return days.map((day) => ({ day, items: (byDay.get(dayKey(day)) ?? []).sort(compareByTime) }));
};
