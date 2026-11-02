import { describe, expect, it, mock } from 'bun:test';

import { DailyReminderScheduler, nextRunAt } from './index';

const iso = (d: Date) => d.toISOString();

describe('nextRunAt (08:30 Europe/London)', () => {
    it('before 08:30 -> today 08:30, BST = 07:30Z', () => {
        expect(iso(nextRunAt(new Date('2026-06-25T06:00:00Z')))).toBe('2026-06-25T07:30:00.000Z');
    });

    it('after 08:30 -> tomorrow 08:30, BST = 07:30Z', () => {
        expect(iso(nextRunAt(new Date('2026-06-25T08:00:00Z')))).toBe('2026-06-26T07:30:00.000Z');
    });

    it('winter (GMT) 08:30 = 08:30Z, proving wall-clock is fixed', () => {
        expect(iso(nextRunAt(new Date('2026-01-15T06:00:00Z')))).toBe('2026-01-15T08:30:00.000Z');
    });

    it('keeps 08:30 wall-clock across the BST->GMT boundary', () => {
        // 26 Oct 2026 is the first full GMT day after clocks go back (25 Oct).
        expect(iso(nextRunAt(new Date('2026-10-26T06:00:00Z')))).toBe('2026-10-26T08:30:00.000Z');
    });
});

describe('DailyReminderScheduler', () => {
    it('schedules the reminder and runs it once per UK day on fire', async () => {
        const reminder = { sendDailyReminders: mock(async () => {}) };
        let captured: (() => void) | undefined;
        const schedule = mock((fn: () => void, _ms: number) => {
            captured = fn;
            return 0 as unknown as ReturnType<typeof setTimeout>;
        });
        let current = new Date('2026-06-25T06:00:00Z');

        const scheduler = new DailyReminderScheduler(reminder as never, {
            now: () => current,
            schedule: schedule as never,
        });
        scheduler.start();
        expect(schedule).toHaveBeenCalledTimes(1);

        // Fire: advance clock to the run instant and invoke the captured callback.
        current = new Date('2026-06-25T07:30:00Z');
        await captured?.();
        expect(reminder.sendDailyReminders).toHaveBeenCalledTimes(1);
        // Re-armed for the next day.
        expect(schedule).toHaveBeenCalledTimes(2);

        // Firing again on the SAME UK day does not double-send (guard).
        await captured?.();
        expect(reminder.sendDailyReminders).toHaveBeenCalledTimes(1);
    });

    it('never throws if the reminder rejects, and still re-arms', async () => {
        const reminder = {
            sendDailyReminders: mock(async () => {
                throw new Error('boom');
            }),
        };
        let captured: (() => void) | undefined;
        const schedule = mock((fn: () => void) => {
            captured = fn;
            return 0 as never;
        });
        const scheduler = new DailyReminderScheduler(reminder as never, {
            now: () => new Date('2026-06-25T07:30:00Z'),
            schedule: schedule as never,
        });
        scheduler.start();
        await expect(captured?.()).resolves.toBeUndefined();
        expect(schedule).toHaveBeenCalledTimes(2); // re-armed despite the error
    });
});
