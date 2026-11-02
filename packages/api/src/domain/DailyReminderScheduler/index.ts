import type { Logger } from '@imapps/api-utils';

import { caughtErrorSchema } from '../../infrastructure/caughtError';
import type { TodoReminderService } from '../TodoReminderService';

const TIME_ZONE = 'Europe/London';

interface LondonFields {
    y: number;
    mo: number;
    da: number;
    h: number;
    mi: number;
    s: number;
}

const londonFields = (date: Date): LondonFields => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const parts: Record<string, string> = {};

    for (const part of fmt.formatToParts(date)) {
        parts[part.type] = part.value;
    }

    // Intl emits hour '24' for midnight in some runtimes; normalise to 0.
    const hour = parts.hour === '24' ? 0 : Number(parts.hour);

    return {
        y: Number(parts.year),
        mo: Number(parts.month),
        da: Number(parts.day),
        h: hour,
        mi: Number(parts.minute),
        s: Number(parts.second),
    };
};

/** UTC instant for a Europe/London wall-clock time (safe outside DST transition gaps). */
const ukWallClockToUtc = (y: number, mo: number, da: number, h: number, mi: number): Date => {
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    const f = londonFields(new Date(guess));
    const asIfUtc = Date.UTC(f.y, f.mo - 1, f.da, f.h, f.mi, f.s);
    const offset = asIfUtc - guess; // ms London is ahead of UTC

    return new Date(guess - offset);
};

/** Next instant whose Europe/London wall-clock time is `hour:minute`, strictly after `from`. */
// fallow-ignore-next-line unused-export
export const nextRunAt = (from: Date, hour = 8, minute = 30): Date => {
    const f = londonFields(from);
    const today = ukWallClockToUtc(f.y, f.mo, f.da, hour, minute);

    if (today.getTime() > from.getTime()) {
        return today;
    }

    // Advance one UK calendar day using a midday anchor to avoid TZ slippage.
    const nextAnchor = new Date(Date.UTC(f.y, f.mo - 1, f.da + 1, 12));
    const n = londonFields(nextAnchor);

    return ukWallClockToUtc(n.y, n.mo, n.da, hour, minute);
};

const ukDayKey = (date: Date): string => {
    const f = londonFields(date);

    return `${f.y}-${f.mo}-${f.da}`;
};

export class DailyReminderScheduler {
    private lastRunDay?: string;
    private readonly now: () => Date;
    private readonly schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    private readonly logger?: Logger;

    constructor(
        private readonly reminder: TodoReminderService,
        opts?: {
            now?: () => Date;
            schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
            logger?: Logger;
        }
    ) {
        this.now = opts?.now ?? (() => new Date());
        this.schedule = opts?.schedule ?? ((fn, ms) => setTimeout(fn, ms));
        this.logger = opts?.logger;
    }

    start(): void {
        const from = this.now();
        const delay = Math.max(0, nextRunAt(from).getTime() - from.getTime());
        this.schedule(() => this.fire(), delay);
    }

    private async fire(): Promise<void> {
        const now = this.now();
        const dayKey = ukDayKey(now);

        try {
            if (this.lastRunDay !== dayKey) {
                this.lastRunDay = dayKey;
                await this.reminder.sendDailyReminders(now);
            }
        } catch (error) {
            this.logger?.error('Daily reminder run failed', { error: caughtErrorSchema.parse(error).message });
        } finally {
            this.start();
        }
    }
}
