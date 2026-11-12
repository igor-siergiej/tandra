import { describe, expect, it } from 'bun:test';

import { check, summarise } from './check-coverage.js';

const lcov = (rows) =>
    rows
        .map(([lf, lh, fnf, fnh]) => `TN:\nSF:x.ts\nFNF:${fnf}\nFNH:${fnh}\nLF:${lf}\nLH:${lh}\nend_of_record`)
        .join('\n');

describe('summarise', () => {
    it('adds up lines and functions across files', () => {
        const { lines, functions } = summarise(
            lcov([
                [10, 9, 2, 2],
                [10, 5, 2, 0],
            ])
        );

        expect(lines).toBe(70);
        expect(functions).toBe(50);
    });

    it('treats an empty report as fully covered rather than dividing by zero', () => {
        expect(summarise('')).toEqual({ lines: 100, functions: 100 });
    });
});

describe('check', () => {
    it('passes at or above the threshold', () => {
        expect(check(lcov([[10, 9, 10, 9]]), 90).failures).toEqual([]);
    });

    it('fails with a message naming each metric that is under', () => {
        const { failures } = check(lcov([[100, 80, 100, 95]]), 90);

        expect(failures).toEqual(['lines coverage 80.00% is below 90%']);
    });

    it('a deliberately under-covered change fails the gate', () => {
        expect(check(lcov([[100, 89, 100, 89]]), 90).failures).toHaveLength(2);
    });
});
