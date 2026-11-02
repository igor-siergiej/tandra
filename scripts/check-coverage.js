#!/usr/bin/env bun
// Fails when aggregate line or function coverage in an lcov file is below a threshold.
// `bun test --coverage` has no global threshold (bunfig coverageThreshold applies per file), so CI parses lcov.
import { readFileSync } from 'node:fs';

export const summarise = (lcov) => {
    const totals = { lines: { found: 0, hit: 0 }, functions: { found: 0, hit: 0 } };

    for (const line of lcov.split('\n')) {
        const [key, value] = [line.slice(0, line.indexOf(':')), Number(line.slice(line.indexOf(':') + 1))];

        if (key === 'LF') totals.lines.found += value;
        else if (key === 'LH') totals.lines.hit += value;
        else if (key === 'FNF') totals.functions.found += value;
        else if (key === 'FNH') totals.functions.hit += value;
    }

    const pct = ({ found, hit }) => (found === 0 ? 100 : (hit / found) * 100);

    return { lines: pct(totals.lines), functions: pct(totals.functions) };
};

export const check = (lcov, threshold) => {
    const result = summarise(lcov);

    const failures = Object.entries(result)
        .filter(([, value]) => value < threshold)
        .map(([name, value]) => `${name} coverage ${value.toFixed(2)}% is below ${threshold}%`);

    return { result, failures };
};

if (import.meta.main) {
    const [file = 'packages/api/coverage/lcov.info', threshold = '90'] = process.argv.slice(2);
    const { result, failures } = check(readFileSync(file, 'utf8'), Number(threshold));
    console.log(`Coverage: lines ${result.lines.toFixed(2)}%, functions ${result.functions.toFixed(2)}%`);

    if (failures.length > 0) {
        for (const failure of failures) console.error(`❌ ${failure}`);
        process.exit(1);
    }

    console.log(`✅ Meets the ${threshold}% threshold`);
}
