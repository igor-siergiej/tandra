// One-off: lists are addressed by title, so duplicates make getByTitle ambiguous.
// Keeps the oldest list per title and renames the others to "<title> (2)", "<title> (3)", ...
// Usage: CONNECTION_URI=... DATABASE_NAME=... bun scripts/dedupe-list-titles.ts [--apply]
import { MongoClient } from 'mongodb';

const apply = process.argv.includes('--apply');
const uri = process.env.CONNECTION_URI;
const dbName = process.env.DATABASE_NAME;

if (!uri || !dbName) {
    console.error('CONNECTION_URI and DATABASE_NAME are required');
    process.exit(1);
}

const client = new MongoClient(uri);

try {
    const lists = client.db(dbName).collection<{ id: string; title: string; dateAdded: Date }>('list');
    const all = await lists.find({}, { projection: { id: 1, title: 1, dateAdded: 1 } }).toArray();
    const taken = new Set(all.map((l) => l.title));
    const byTitle = new Map<string, typeof all>();

    for (const l of all) {
        byTitle.set(l.title, [...(byTitle.get(l.title) ?? []), l]);
    }

    let renamed = 0;

    for (const [title, group] of byTitle) {
        if (group.length < 2) continue;
        group.sort((a, b) => String(a.dateAdded).localeCompare(String(b.dateAdded)));
        console.log(`"${title}": ${group.length} lists`);
        let n = 2;

        for (const dupe of group.slice(1)) {
            while (taken.has(`${title} (${n})`)) n++;
            const next = `${title} (${n})`;
            taken.add(next);
            console.log(`  ${dupe.id} -> "${next}"${apply ? '' : ' (dry run)'}`);

            if (apply) await lists.updateOne({ id: dupe.id }, { $set: { title: next } });
            renamed++;
        }
    }

    console.log(`${renamed} list(s) ${apply ? 'renamed' : 'would be renamed (pass --apply)'}`);
} finally {
    await client.close();
}
