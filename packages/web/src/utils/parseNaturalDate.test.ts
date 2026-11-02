import { describe, expect, it } from 'vitest';

import { parseNaturalDate } from './parseNaturalDate';

describe('parseNaturalDate', () => {
    const ref = new Date('2026-06-22T12:00:00'); // Monday

    it('returns undefined for empty / whitespace input', () => {
        expect(parseNaturalDate('', ref)).toBeUndefined();
        expect(parseNaturalDate('   ', ref)).toBeUndefined();
    });

    it('returns undefined for unrecognized text', () => {
        expect(parseNaturalDate('asdfqwer', ref)).toBeUndefined();
    });

    it('parses "tomorrow" relative to ref', () => {
        const d = parseNaturalDate('tomorrow', ref);
        expect(d?.getDate()).toBe(23);
        expect(d?.getMonth()).toBe(5); // June
    });

    it('parses "in 3 days"', () => {
        expect(parseNaturalDate('in 3 days', ref)?.getDate()).toBe(25);
    });

    it('biases bare weekday to the future (forwardDate)', () => {
        // ref is Monday 22nd; "friday" -> 26th, not a past friday
        expect(parseNaturalDate('friday', ref)?.getDate()).toBe(26);
    });

    it('parses an explicit date like "25 dec"', () => {
        const d = parseNaturalDate('25 dec', ref);
        expect(d?.getDate()).toBe(25);
        expect(d?.getMonth()).toBe(11); // December
    });
});
