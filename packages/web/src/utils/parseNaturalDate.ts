import * as chrono from 'chrono-node';

/**
 * Parse free-text like "tomorrow", "next friday", "in 3 days", "25 dec" into a Date.
 * forwardDate biases bare weekdays/dates to the future. Returns undefined when nothing parses.
 */
export const parseNaturalDate = (text: string, ref: Date = new Date()): Date | undefined => {
    const trimmed = text.trim();

    if (!trimmed) return undefined;

    return chrono.parseDate(trimmed, ref, { forwardDate: true }) ?? undefined;
};
