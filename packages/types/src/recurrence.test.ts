import { describe, expect, it } from 'bun:test';

import type { Todo } from './index';
import { occursOn, parseDay } from './recurrence';

const base: Todo = {
    id: 't1',
    ownerId: 'u1',
    title: 'Task',
    done: false,
    dateAdded: new Date('2026-06-01'),
};

const at = (s: string) => new Date(s);

describe('parseDay', () => {
    it('parses a YYYY-MM-DD string to local midnight of that calendar day', () => {
        const d = parseDay('2026-07-02');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(6);
        expect(d.getDate()).toBe(2);
        expect(d.getHours()).toBe(0);
    });

    it('tolerates a legacy full ISO string by keeping the day part', () => {
        expect(parseDay('2026-07-02T00:00:00.000Z' as string).getDate()).toBe(2);
    });

    it('tolerates a legacy Date by bucketing to its local calendar day', () => {
        const d = parseDay(new Date(2026, 6, 2, 15, 0) as unknown as string);
        expect(d.getMonth()).toBe(6);
        expect(d.getDate()).toBe(2);
        expect(d.getHours()).toBe(0);
    });
});

describe('occursOn', () => {
    it('true for a single todo due on the day', () => {
        expect(occursOn({ ...base, dueDate: '2026-06-25' }, at('2026-06-25T09:00:00Z'))).toBe(true);
    });

    it('false for a single todo due on another day', () => {
        expect(occursOn({ ...base, dueDate: '2026-06-24' }, at('2026-06-25T09:00:00Z'))).toBe(false);
    });

    it('false for a done single todo', () => {
        expect(occursOn({ ...base, done: true, dueDate: '2026-06-25' }, at('2026-06-25T09:00:00Z'))).toBe(false);
    });

    it('true for a daily recurrence landing on the day', () => {
        const todo: Todo = { ...base, dueDate: '2026-06-01', recurrence: { freq: 'daily', interval: 1 } };
        expect(occursOn(todo, at('2026-06-25T09:00:00Z'))).toBe(true);
    });

    it('false when recurrence has ended via until', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-06-01',
            recurrence: { freq: 'daily', interval: 1, until: '2026-06-10' },
        };

        expect(occursOn(todo, at('2026-06-25T09:00:00Z'))).toBe(false);
    });

    it('false when the recurring instance is already completed for that day', () => {
        const todo: Todo = {
            ...base,
            dueDate: '2026-06-01',
            recurrence: { freq: 'daily', interval: 1 },
            completedDates: ['2026-06-25'],
        };

        expect(occursOn(todo, at('2026-06-25T09:00:00Z'))).toBe(false);
    });

    it('false for an unscheduled (Inbox) todo with no dueDate', () => {
        expect(occursOn(base, at('2026-06-25T09:00:00Z'))).toBe(false);
    });

    it('matches a date-only dueDate against a morning reference instant (no tz day-shift)', () => {
        // The storage bug: a Date at local-midnight drifted a day on a UTC server. A YYYY-MM-DD
        // day is tz-agnostic, so the 08:30 reminder finds it as due today.
        expect(occursOn({ ...base, dueDate: '2026-07-02' }, at('2026-07-02T07:30:00Z'))).toBe(true);
    });
});
