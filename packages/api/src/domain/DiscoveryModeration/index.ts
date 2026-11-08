import type { Logger } from '@imapps/api-utils';
import type { DiscoveryReportSummary, User } from '@tandra/types';

import type { DiscoveryPublicationRepository } from '../DiscoveryPublicationRepository';
import type { DiscoveryReportRepository } from '../DiscoveryReportRepository';
import type { DiscoveryService } from '../DiscoveryService';
import type { IdGenerator } from '../IdGenerator';

const MAX_REASON_LENGTH = 500;

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

/**
 * Moderation of public recipes: anyone signed in can report one; only an admin can delist one.
 * Admins are the user ids listed in `DISCOVERY_ADMIN_USER_IDS`; with none configured nobody can delist.
 */
export class DiscoveryModerationService {
    constructor(
        private readonly discovery: Pick<DiscoveryService, 'getRecipe' | 'getRecipes' | 'remove'>,
        private readonly reports: DiscoveryReportRepository,
        private readonly publications: DiscoveryPublicationRepository,
        private readonly idGenerator: IdGenerator,
        private readonly adminUserIds: ReadonlySet<string>,
        private readonly logger?: Logger
    ) {}

    isAdmin(user: User): boolean {
        return this.adminUserIds.has(user.id);
    }

    async report(libraryId: string, reporter: User, reason?: string): Promise<void> {
        await this.discovery.getRecipe(libraryId);
        const text = reason?.trim().slice(0, MAX_REASON_LENGTH);
        await this.reports.upsert({
            id: this.idGenerator.generate(),
            recipeId: libraryId,
            reporterId: reporter.id,
            ...(text && { reason: text }),
            createdAt: new Date(),
        });
        this.logger?.warn('Library recipe reported', { libraryId, reporterId: reporter.id });
    }

    /** Reported recipes, most recently reported first. Admin only. */
    // Groups reports per recipe, then drops those whose recipe has gone.
    // fallow-ignore-next-line complexity
    async listReports(admin: User): Promise<DiscoveryReportSummary[]> {
        this.assertAdmin(admin);
        const byRecipe = new Map<string, { reasons: string[]; count: number; last: Date }>();

        for (const report of await this.reports.listAll()) {
            const entry = byRecipe.get(report.recipeId) ?? { reasons: [], count: 0, last: report.createdAt };
            entry.count += 1;

            if (report.reason) entry.reasons.push(report.reason);

            if (report.createdAt > entry.last) entry.last = report.createdAt;
            byRecipe.set(report.recipeId, entry);
        }

        // One query for every reported recipe; a report for a recipe that has since gone is stale, not an error.
        const recipes = new Map((await this.discovery.getRecipes([...byRecipe.keys()])).map((r) => [r.id, r]));

        const summaries: DiscoveryReportSummary[] = [];

        for (const [recipeId, entry] of byRecipe) {
            const recipe = recipes.get(recipeId);

            if (!recipe) continue;
            summaries.push({
                recipeId,
                title: recipe.title,
                source: recipe.source,
                reports: entry.count,
                reasons: entry.reasons,
                lastReportedAt: entry.last,
            });
        }

        return summaries.sort((a, b) => b.lastReportedAt.getTime() - a.lastReportedAt.getTime());
    }

    /**
     * Removes a user-published recipe from Mongo and the index. Wikibooks recipes are refused: the next ingest would
     * simply bring them back, so a delist would only look like it worked.
     */
    async delist(libraryId: string, admin: User): Promise<void> {
        this.assertAdmin(admin);
        const recipe = await this.discovery.getRecipe(libraryId);

        if (recipe.source !== 'user') {
            throw fail('Only user-published recipes can be delisted; Wikibooks recipes are managed by the ingest', 400);
        }

        await this.discovery.remove(libraryId);
        await this.publications.deleteByLibraryId(libraryId);
        await this.reports.deleteByRecipeId(libraryId);
        this.logger?.warn('Library recipe delisted by an admin', { libraryId, adminId: admin.id });
    }

    private assertAdmin(user: User): void {
        if (!this.isAdmin(user)) throw fail('Admin access required', 403);
    }
}
