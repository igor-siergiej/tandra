import type { Todo } from '@tandra/types';
import { endOfMonth, startOfMonth } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { dayKey } from '../components/Calendar/MonthGrid';
import { buildCalendarDayData, buildWeekAgenda } from './calendar';
import { isoDay } from './recurrence';

const today = new Date();

const todo = (id: string, labelId?: string): Todo =>
    ({ id, ownerId: 'u', title: id, done: false, dateAdded: today, dueDate: isoDay(today), labelId }) as Todo;

const ctx = (activeLabels: string[] = []) => ({
    labelColor: new Map<string, string>([['L1', '#ff0000']]),
    activeLabels: new Set(activeLabels),
});

const build = (todos: Todo[], activeLabels: string[]) =>
    buildCalendarDayData(todos, today, today, startOfMonth(today), endOfMonth(today), ctx(activeLabels));

describe('buildCalendarDayData dimming', () => {
    it('dims nothing when no label filter is active', () => {
        const { selectedItems } = build([todo('a', 'L1'), todo('b')], []);
        expect(selectedItems.every((i) => !i.dimmed)).toBe(true);
    });

    it('dims only todos whose label is not active', () => {
        const { selectedItems } = build([todo('a', 'L1'), todo('b')], ['L1']);
        expect(selectedItems.find((i) => i.todoId === 'a')?.dimmed).toBe(false);
        expect(selectedItems.find((i) => i.todoId === 'b')?.dimmed).toBe(true);
    });

    it('keeps all todos in the result when filtering (grey-out, not hide)', () => {
        const { selectedItems } = build([todo('a', 'L1'), todo('b')], ['L1']);
        expect(selectedItems).toHaveLength(2);
    });

    it('dims month-grid dots for non-matching todos', () => {
        const { dotsByDay } = build([todo('a', 'L1'), todo('b')], ['L1']);
        const dots = dotsByDay[dayKey(today)];
        expect(dots).toHaveLength(2);
        expect(dots.some((d) => d.dimmed === false)).toBe(true);
        expect(dots.some((d) => d.dimmed === true)).toBe(true);
    });
});

describe('time ordering', () => {
    const timed = (id: string, time?: string): Todo => ({ ...todo(id), time });

    it('puts all-day todos first, then timed ones in clock order', () => {
        const { selectedItems } = build([timed('late', '18:00'), timed('early', '07:15'), timed('any')], []);
        expect(selectedItems.map((i) => i.todoId)).toEqual(['any', 'early', 'late']);
    });

    it('orders each week-agenda day the same way', () => {
        const days = buildWeekAgenda([timed('late', '18:00'), timed('early', '07:15')], today, ctx());
        expect(days[0].items.map((i) => i.todoId)).toEqual(['early', 'late']);
    });
});

describe('overdue marking', () => {
    const on = (id: string, dueDate: string, done = false): Todo => ({ ...todo(id), dueDate, done });
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

    it('flags an unfinished todo from a past day', () => {
        const { selectedItems } = buildCalendarDayData(
            [on('old', isoDay(yesterday))],
            today,
            yesterday,
            startOfMonth(yesterday),
            endOfMonth(yesterday),
            ctx()
        );
        expect(selectedItems[0].overdue).toBe(true);
    });

    it('does not flag a finished past todo', () => {
        const { selectedItems } = buildCalendarDayData(
            [on('old', isoDay(yesterday), true)],
            today,
            yesterday,
            startOfMonth(yesterday),
            endOfMonth(yesterday),
            ctx()
        );
        expect(selectedItems[0].overdue).toBe(false);
    });

    it('does not flag a todo due today', () => {
        const { selectedItems } = build([todo('now')], []);
        expect(selectedItems[0].overdue).toBe(false);
    });
});
