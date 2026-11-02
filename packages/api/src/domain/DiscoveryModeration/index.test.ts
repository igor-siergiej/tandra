import { describe, expect, it } from 'bun:test';

import type { DiscoveryRecipe, User } from '@tandra/types';

import type { DiscoveryPublication } from '../DiscoveryPublicationRepository';
import type { DiscoveryReport } from '../DiscoveryReportRepository';
import { DiscoveryModerationService } from './index';

const admin: User = { id: 'u-admin', username: 'admin' };
const alice: User = { id: 'u-alice', username: 'alice' };
const bob: User = { id: 'u-bob', username: 'bob' };

const recipe = (id: string, source: DiscoveryRecipe['source'], title = id): DiscoveryRecipe => ({
    id,
    title,
    ingredients: [],
    instructions: [],
    tags: [],
    source,
    sourceUrl: 'x',
    licence: 'CC-BY-SA-4.0',
    attribution: 'x',
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

const setup = (admins: string[] = [admin.id]) => {
    const library = new Map([
        ['user-1', recipe('user-1', 'user', 'Public Soup')],
        ['user-2', recipe('user-2', 'user', 'Public Stew')],
        ['wikibooks-1', recipe('wikibooks-1', 'wikibooks', 'Wiki Cake')],
    ]);
    const indexed = new Set(library.keys());
    const getRecipesCalls: string[][] = [];
    const discovery = {
        getRecipes: async (ids: string[]) => {
            getRecipesCalls.push(ids);
            return ids.flatMap((id) => library.get(id) ?? []);
        },
        getRecipe: async (id: string) => {
            const found = library.get(id);
            if (!found) throw Object.assign(new Error('Library recipe not found'), { status: 404 });
            return found;
        },
        remove: async (id: string) => {
            library.delete(id);
            indexed.delete(id);
        },
    };
    const reportRows: DiscoveryReport[] = [];
    const reports = {
        ensureIndexes: async () => {},
        upsert: async (report: DiscoveryReport) => {
            const at = reportRows.findIndex(
                (r) => r.recipeId === report.recipeId && r.reporterId === report.reporterId
            );
            if (at === -1) reportRows.push(report);
            else reportRows[at] = report;
        },
        listAll: async () => [...reportRows],
        deleteByRecipeId: async (id: string) => {
            for (let i = reportRows.length - 1; i >= 0; i -= 1)
                if (reportRows[i]?.recipeId === id) reportRows.splice(i, 1);
        },
    };
    const rows = new Map<string, DiscoveryPublication>([
        ['r1', { recipeId: 'r1', libraryId: 'user-1', ownerId: alice.id, publishedAt: new Date(0) }],
    ]);
    const publications = {
        ensureIndexes: async () => {},
        getByRecipeId: async () => null,
        getByLibraryId: async () => null,
        listPublishedByOwner: async () => [],
        upsert: async () => {},
        deleteByLibraryId: async (id: string) => {
            for (const [key, row] of rows) if (row.libraryId === id) rows.delete(key);
        },
    };
    let n = 0;
    const service = new DiscoveryModerationService(
        discovery,
        reports,
        publications,
        { generate: () => `rep-${++n}` },
        new Set(admins)
    );
    return { service, library, indexed, reportRows, rows, getRecipesCalls };
};

describe('DiscoveryModerationService.report', () => {
    it('records a report for an existing library recipe', async () => {
        const { service, reportRows } = setup();

        await service.report('user-1', bob, '  rude text  ');

        expect(reportRows).toEqual([
            expect.objectContaining({ recipeId: 'user-1', reporterId: 'u-bob', reason: 'rude text' }),
        ]);
    });

    it('keeps one report per person per recipe: reporting again replaces the reason', async () => {
        const { service, reportRows } = setup();

        await service.report('user-1', bob, 'spam');
        await service.report('user-1', bob, 'actually offensive');

        expect(reportRows).toHaveLength(1);
        expect(reportRows[0]?.reason).toBe('actually offensive');
    });

    it('404s for a recipe that is not in the library and caps an absurdly long reason', async () => {
        const { service, reportRows } = setup();

        await expect(service.report('nope', bob)).rejects.toMatchObject({ status: 404 });
        await service.report('user-1', bob, 'x'.repeat(5000));

        expect(reportRows[0]?.reason).toHaveLength(500);
    });
});

describe('DiscoveryModerationService.listReports', () => {
    it('groups reports per recipe with counts and reasons, newest first, without naming reporters', async () => {
        const { service, reportRows } = setup();
        await service.report('user-1', alice, 'spam');
        await service.report('user-1', bob, 'rude');
        await service.report('user-2', bob);
        // Make recipe 2's report the most recent.
        const last = reportRows.find((r) => r.recipeId === 'user-2') as DiscoveryReport;
        last.createdAt = new Date(Date.now() + 60_000);

        const summaries = await service.listReports(admin);

        expect(summaries.map((s) => [s.recipeId, s.title, s.reports])).toEqual([
            ['user-2', 'Public Stew', 1],
            ['user-1', 'Public Soup', 2],
        ]);
        expect(summaries[1]?.reasons.sort()).toEqual(['rude', 'spam']);
        expect(JSON.stringify(summaries)).not.toContain('u-bob');
        expect(JSON.stringify(summaries)).not.toContain('u-alice');
    });

    it('loads every reported recipe in one query rather than one per report', async () => {
        const { service, getRecipesCalls } = setup();
        await service.report('user-1', alice, 'spam');
        await service.report('user-2', bob, 'rude');
        await service.report('wikibooks-1', alice, 'odd');

        await service.listReports(admin);

        expect(getRecipesCalls).toHaveLength(1);
        expect(getRecipesCalls[0].sort()).toEqual(['user-1', 'user-2', 'wikibooks-1']);
    });

    it('skips reports for recipes that have since gone', async () => {
        const { service, library } = setup();
        await service.report('user-1', bob, 'spam');
        library.delete('user-1');

        expect(await service.listReports(admin)).toEqual([]);
    });

    it('is admin only', async () => {
        const { service } = setup();
        await expect(service.listReports(bob)).rejects.toMatchObject({ status: 403 });
    });
});

describe('DiscoveryModerationService.delist', () => {
    it('removes a user-published recipe from the library and the index, with its publication and reports', async () => {
        const { service, library, indexed, rows, reportRows } = setup();
        await service.report('user-1', bob, 'spam');

        await service.delist('user-1', admin);

        expect(library.has('user-1')).toBe(false);
        expect(indexed.has('user-1')).toBe(false);
        expect(rows.size).toBe(0);
        expect(reportRows).toEqual([]);
        // Other library recipes are untouched.
        expect(library.has('user-2')).toBe(true);
    });

    it('is refused for a non-admin, and the recipe stays: not even its publisher may use it', async () => {
        const { service, library, indexed } = setup();

        await expect(service.delist('user-1', bob)).rejects.toMatchObject({ status: 403 });
        await expect(service.delist('user-1', alice)).rejects.toMatchObject({ status: 403 });

        expect(library.has('user-1')).toBe(true);
        expect(indexed.has('user-1')).toBe(true);
    });

    it('lets nobody delist when no admin is configured', async () => {
        const { service, library } = setup([]);

        await expect(service.delist('user-1', admin)).rejects.toMatchObject({ status: 403 });
        expect(service.isAdmin(admin)).toBe(false);
        expect(library.has('user-1')).toBe(true);
    });

    it('refuses to delist a Wikibooks recipe, which the next ingest would simply restore', async () => {
        const { service, library } = setup();

        await expect(service.delist('wikibooks-1', admin)).rejects.toMatchObject({ status: 400 });
        expect(library.has('wikibooks-1')).toBe(true);
    });

    it('404s for an unknown recipe', async () => {
        const { service } = setup();
        await expect(service.delist('user-404', admin)).rejects.toMatchObject({ status: 404 });
    });
});
