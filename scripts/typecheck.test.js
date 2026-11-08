import { describe, expect, it } from 'bun:test';

import { diff, parseErrors, tally } from './typecheck.js';

const tscOutput = (lines) => lines.join('\n');

describe('parseErrors', () => {
    it('reads an error with a line and column', () => {
        const errors = parseErrors(tscOutput(['packages/web/src/app.ts(12,5): error TS2345: Argument is wrong.']));

        expect(errors).toEqual([
            { file: 'packages/web/src/app.ts', line: 12, column: 5, code: 'TS2345', message: 'Argument is wrong.' },
        ]);
    });

    it('reads an error without a position', () => {
        const errors = parseErrors(tscOutput(['packages/types/src/index.ts: error TS6305: Output file is missing.']));

        expect(errors).toEqual([
            {
                file: 'packages/types/src/index.ts',
                line: 0,
                column: 0,
                code: 'TS6305',
                message: 'Output file is missing.',
            },
        ]);
    });

    it('ignores lines that are not errors', () => {
        const errors = parseErrors(tscOutput(['packages/web/src/app.ts(1,1): error TS2345: Bad.', 'Found 1 error.']));

        expect(errors).toHaveLength(1);
    });

    it('keeps a message that itself contains a colon', () => {
        const errors = parseErrors(
            tscOutput(["packages/web/src/app.ts(1,1): error TS2322: Type 'a' is not assignable to type 'b'."])
        );

        expect(errors[0].message).toBe("Type 'a' is not assignable to type 'b'.");
    });
});

describe('tally', () => {
    it('groups errors by file and code', () => {
        const counts = tally([
            { file: 'a.ts', line: 1, column: 1, code: 'TS2345', message: 'x' },
            { file: 'a.ts', line: 2, column: 1, code: 'TS2345', message: 'y' },
            { file: 'a.ts', line: 3, column: 1, code: 'TS7006', message: 'z' },
            { file: 'b.ts', line: 1, column: 1, code: 'TS2345', message: 'w' },
        ]);

        expect([...counts.keys()].sort()).toEqual(['a.ts::TS2345', 'a.ts::TS7006', 'b.ts::TS2345']);
        expect(counts.get('a.ts::TS2345')).toHaveLength(2);
    });
});

describe('diff', () => {
    const baseline = { 'a.ts::TS2345': 2, 'b.ts::TS2345': 1 };

    it('passes when every error is already in the baseline', () => {
        const current = tally([
            { file: 'a.ts', line: 1, column: 1, code: 'TS2345', message: 'x' },
            { file: 'a.ts', line: 2, column: 1, code: 'TS2345', message: 'y' },
            { file: 'b.ts', line: 1, column: 1, code: 'TS2345', message: 'z' },
        ]);

        expect(diff(current, baseline).added).toEqual([]);
    });

    it('fails when an error appears that the baseline does not allow', () => {
        const current = tally([
            { file: 'a.ts', line: 1, column: 1, code: 'TS2345', message: 'x' },
            { file: 'a.ts', line: 2, column: 1, code: 'TS2345', message: 'y' },
            { file: 'a.ts', line: 3, column: 1, code: 'TS2345', message: 'new' },
            { file: 'b.ts', line: 1, column: 1, code: 'TS2345', message: 'z' },
        ]);

        const { added } = diff(current, baseline);

        expect(added).toHaveLength(1);
        expect(added[0].key).toBe('a.ts::TS2345');
        expect(added[0].errors).toHaveLength(1);
        expect(added[0].errors[0].message).toBe('new');
    });

    it('fails when an error appears in a file the baseline does not mention', () => {
        const current = tally([{ file: 'new.ts', line: 1, column: 1, code: 'TS2322', message: 'brand new' }]);

        const { added } = diff(current, baseline);

        expect(added).toHaveLength(1);
        expect(added[0].key).toBe('new.ts::TS2322');
    });

    it('reports a shrunk group so the baseline can be tightened', () => {
        const current = tally([{ file: 'b.ts', line: 1, column: 1, code: 'TS2345', message: 'z' }]);

        const { added, fixed } = diff(current, baseline);

        expect(added).toEqual([]);
        expect(fixed).toEqual([{ key: 'a.ts::TS2345', allowed: 2, actual: 0 }]);
    });

    it('does not report a group as fixed when it is unchanged', () => {
        const current = tally([
            { file: 'a.ts', line: 1, column: 1, code: 'TS2345', message: 'x' },
            { file: 'a.ts', line: 2, column: 1, code: 'TS2345', message: 'y' },
            { file: 'b.ts', line: 1, column: 1, code: 'TS2345', message: 'z' },
        ]);

        expect(diff(current, baseline).fixed).toEqual([]);
    });
});
