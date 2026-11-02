import { addDays, addMonths, addWeeks, addYears, format, isAfter, isBefore } from 'date-fns';

import type { Recurrence, Todo } from './index';

export interface Occurrence {
    date: Date;
    done: boolean;
}

export const isoDay = (date: Date): string => format(date, 'yyyy-MM-dd');

const normalize = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Parse a due-day to local midnight of that calendar day — timezone-invariant, no instant drift.
 *
 * Canonical input is a YYYY-MM-DD string. Legacy pre-migration rows may still hold a Date or a
 * full ISO string; those are tolerated so reads never crash mid-migration (a Date is bucketed by
 * its local calendar day, which in the browser is the user's own day).
 */
export const parseDay = (day: string | Date): Date => {
    if (day instanceof Date) return normalize(day);
    const [y, m, d] = day.slice(0, 10).split('-').map(Number);

    return new Date(y, m - 1, d);
};

const ADDERS = {
    daily: addDays,
    weekly: addWeeks,
    monthly: addMonths,
    yearly: addYears,
} as const;

const step = (date: Date, recurrence: Recurrence): Date => ADDERS[recurrence.freq](date, recurrence.interval);

const expandSingle = (dueDate: string, done: boolean, start: Date, end: Date): Occurrence[] => {
    const anchor = parseDay(dueDate);

    if (isBefore(anchor, start) || isAfter(anchor, end)) return [];

    return [{ date: anchor, done }];
};

const resolveLimit = (recurrence: Recurrence, end: Date): Date => {
    if (!recurrence.until) return end;
    const until = parseDay(recurrence.until);

    return isBefore(until, end) ? until : end;
};

const toDoneSet = (dates: string[] | undefined): Set<string> => new Set(dates ?? []);

const expandRecurring = (
    dueDate: string,
    rec: Recurrence,
    completedDates: string[] | undefined,
    start: Date,
    end: Date
): Occurrence[] => {
    const completed = toDoneSet(completedDates);
    const limit = resolveLimit(rec, end);
    const occurrences: Occurrence[] = [];
    let cursor = parseDay(dueDate);

    for (let i = 0; i < 1000 && !isAfter(cursor, limit); i += 1) {
        if (!isBefore(cursor, start)) {
            occurrences.push({ date: cursor, done: completed.has(isoDay(cursor)) });
        }

        cursor = step(cursor, rec);
    }

    return occurrences;
};

export const expandOccurrences = (todo: Todo, rangeStart: Date, rangeEnd: Date): Occurrence[] => {
    if (!todo.dueDate) return [];
    const start = normalize(rangeStart);
    const end = normalize(rangeEnd);

    return todo.recurrence
        ? expandRecurring(todo.dueDate, todo.recurrence, todo.completedDates, start, end)
        : expandSingle(todo.dueDate, todo.done, start, end);
};

/** True if `todo` has an incomplete occurrence on `day` (single or recurring). */
export const occursOn = (todo: Todo, day: Date): boolean => expandOccurrences(todo, day, day).some((o) => !o.done);
