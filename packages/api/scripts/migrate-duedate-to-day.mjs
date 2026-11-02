/**
 * One-off migration: normalise todo `dueDate` and `recurrence.until` to timezone-agnostic
 * YYYY-MM-DD day strings.
 *
 * Legacy rows hold either a BSON Date (post-#98) or a full ISO string (pre-#98). Both encode an
 * instant, and a due day picked at local midnight was stored as the previous day at 23:00Z for a
 * UTC+1 user — so we recover the intended calendar day by formatting the instant in Europe/London.
 * Already-migrated YYYY-MM-DD values are left untouched (idempotent).
 *
 * Run against the target DB:
 *   CONNECTION_URI='mongodb://...' DATABASE_NAME='tandra' \
 *     [TARGET_TZ='Europe/London'] [DRY_RUN=1] node packages/api/scripts/migrate-duedate-to-day.mjs
 */
import { MongoClient } from 'mongodb';
import { z } from 'zod';

const uri = process.env.CONNECTION_URI;
const dbName = process.env.DATABASE_NAME;
const tz = process.env.TARGET_TZ ?? 'Europe/London';
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!uri || !dbName) {
    console.error('Set CONNECTION_URI and DATABASE_NAME.');
    process.exit(1);
}

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** Returns a YYYY-MM-DD string, or null if the value is missing/unparseable/already migrated. */
const toDay = (value) => {
    if (value === null || value === undefined) return null;

    if (dayString.safeParse(value).success) return null; // already a day string
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return dayFormatter.format(date); // en-CA => YYYY-MM-DD
};

const client = new MongoClient(uri);

try {
    await client.connect();
    const todos = client.db(dbName).collection('todo');
    const cursor = todos.find({ $or: [{ dueDate: { $exists: true } }, { 'recurrence.until': { $exists: true } }] });

    let scanned = 0;
    let updated = 0;

    for await (const todo of cursor) {
        scanned += 1;
        const set = {};
        const nextDue = toDay(todo.dueDate);

        if (nextDue) set.dueDate = nextDue;
        const nextUntil = toDay(todo.recurrence?.until);

        if (nextUntil) set['recurrence.until'] = nextUntil;

        if (Object.keys(set).length === 0) continue;
        updated += 1;
        console.log(`${dryRun ? '[dry] ' : ''}${todo.id}: ${JSON.stringify(set)}`);

        if (!dryRun) await todos.updateOne({ _id: todo._id }, { $set: set });
    }

    console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updated} of ${scanned} scanned todo(s). TZ=${tz}`);
} finally {
    await client.close();
}
