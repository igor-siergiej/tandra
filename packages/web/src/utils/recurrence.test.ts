import type { Todo } from '@tandra/types';
import { describe, expect, it } from 'vitest';

import { expandOccurrences, isoDay } from './recurrence';

const base: Todo = {
    id: 't1',
    ownerId: 'u1',
    title: 'X',
    done: false,
    dateAdded: new Date('2026-06-01'),
};

const range = (a: string, b: string) => ({ start: new Date(a), end: new Date(b) });

describe('isoDay', () => {
    it('formats a date as yyyy-MM-dd', () => {
        expect(isoDay(new Date('2026-06-04T10:00:00'))).toBe('2026-06-04');
    });
});

describe('expandOccurrences', () => {
    it('returns nothing for an undated non-recurring todo', () => {
        const { start, end } = range('2026-06-01', '2026-06-30');
        expect(expandOccurrences(base, start, end)).toEqual([]);
    });

    it('returns a single occurrence for a dated todo in range', () => {
        const todo = { ...base, dueDate: '2026-06-04', done: true };
        const { start, end } = range('2026-06-01', '2026-06-30');
        const occ = expandOccurrences(todo, start, end);
        expect(occ).toHaveLength(1);
        expect(isoDay(occ[0].date)).toBe('2026-06-04');
        expect(occ[0].done).toBe(true);
    });

    it('excludes a dated todo outside the range', () => {
        const todo = { ...base, dueDate: '2026-07-04' };
        const { start, end } = range('2026-06-01', '2026-06-30');
        expect(expandOccurrences(todo, start, end)).toEqual([]);
    });

    it('expands a daily recurrence within the range', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-06-03',
            recurrence: { freq: 'daily', interval: 1 },
        };

        const { start, end } = range('2026-06-03', '2026-06-06');
        const days = expandOccurrences(todo, start, end).map((o) => isoDay(o.date));
        expect(days).toEqual(['2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06']);
    });

    it('honours interval > 1 (every 2 days)', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-06-01',
            recurrence: { freq: 'daily', interval: 2 },
        };

        const { start, end } = range('2026-06-01', '2026-06-06');
        const days = expandOccurrences(todo, start, end).map((o) => isoDay(o.date));
        expect(days).toEqual(['2026-06-01', '2026-06-03', '2026-06-05']);
    });

    it('stops at the until date', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-06-01',
            recurrence: { freq: 'daily', interval: 1, until: '2026-06-03' },
        };

        const { start, end } = range('2026-06-01', '2026-06-30');
        const days = expandOccurrences(todo, start, end).map((o) => isoDay(o.date));
        expect(days).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    });

    it('marks per-occurrence done from completedDates', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-06-01',
            recurrence: { freq: 'weekly', interval: 1 },
            completedDates: ['2026-06-08'],
        };

        const { start, end } = range('2026-06-01', '2026-06-15');
        const occ = expandOccurrences(todo, start, end);
        expect(occ.map((o) => isoDay(o.date))).toEqual(['2026-06-01', '2026-06-08', '2026-06-15']);
        expect(occ.map((o) => o.done)).toEqual([false, true, false]);
    });

    it('only emits recurring occurrences within range when anchor precedes range', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-05-30',
            recurrence: { freq: 'daily', interval: 1 },
        };

        const { start, end } = range('2026-06-01', '2026-06-02');
        const days = expandOccurrences(todo, start, end).map((o) => isoDay(o.date));
        expect(days).toEqual(['2026-06-01', '2026-06-02']);
    });
});
