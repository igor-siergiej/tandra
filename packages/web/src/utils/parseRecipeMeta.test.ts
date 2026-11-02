import { describe, expect, it } from 'vitest';

import { parseDurationMinutes, parseServings, toOptionalNumber } from './parseRecipeMeta';

describe('parseDurationMinutes', () => {
    it('parses a minutes-only ISO-8601 duration', () => {
        expect(parseDurationMinutes('PT20M')).toBe(20);
    });

    it('parses an hours-and-minutes ISO-8601 duration', () => {
        expect(parseDurationMinutes('PT1H30M')).toBe(90);
    });

    it('parses an hours-only ISO-8601 duration', () => {
        expect(parseDurationMinutes('PT2H')).toBe(120);
    });

    it('falls back to a leading number in plain text', () => {
        expect(parseDurationMinutes('20 mins')).toBe(20);
    });

    it('returns undefined for a string with no number', () => {
        expect(parseDurationMinutes('a while')).toBeUndefined();
    });
});

describe('parseServings', () => {
    it('parses a plain number', () => {
        expect(parseServings('4')).toBe(4);
    });

    it('parses "N servings"', () => {
        expect(parseServings('8 servings')).toBe(8);
    });

    it('parses "Serves N"', () => {
        expect(parseServings('Serves 4')).toBe(4);
    });

    it('takes the low end of a range', () => {
        expect(parseServings('4-6')).toBe(4);
    });

    it('returns undefined for a string with no number', () => {
        expect(parseServings('a crowd')).toBeUndefined();
    });
});

describe('toOptionalNumber', () => {
    it('parses a positive integer string', () => {
        expect(toOptionalNumber('20')).toBe(20);
    });

    it('returns undefined for an empty string', () => {
        expect(toOptionalNumber('')).toBeUndefined();
    });

    it('returns undefined for a blank string', () => {
        expect(toOptionalNumber('   ')).toBeUndefined();
    });

    it('returns undefined for a non-numeric string', () => {
        expect(toOptionalNumber('abc')).toBeUndefined();
    });

    it('returns undefined for a negative number', () => {
        expect(toOptionalNumber('-5')).toBeUndefined();
    });
});
