import type { Logger } from '@imapps/api-utils';
import type { User } from '@tandra/types';

import type { DiscoveryPublicationRepository } from '../DiscoveryPublicationRepository';
import type { DiscoveryReportRepository } from '../DiscoveryReportRepository';
import type { DiscoveryService } from '../DiscoveryService';
import type { FriendRepository } from '../FriendRepository';
import type { LabelRepository } from '../LabelRepository';
import type { ListInviteRepository } from '../ListInviteRepository';
import type { ListRepository } from '../ListRepository';
import type { MealPlanRepository } from '../MealPlanRepository';
import type { PushSubscriptionRepository } from '../PushSubscriptionRepository';
import type { RecipeRepository } from '../RecipeRepository';
import type { TodoRepository } from '../TodoRepository';

/** The object store, as far as erasing a user's files needs it. */
export interface ObjectEraser {
    listKeys(prefix: string): Promise<string[]>;
    /** Removes the keys; one that is already gone is not an error. */
    removeKeys(keys: string[]): Promise<void>;
}

/** Whatever holds the sign-in side of an account (Better Auth: user, account, session, verification rows). */
export interface CredentialsEraser {
    /** Removes the sign-in rows and every session of the user. Safe to repeat. */
    eraseCredentials(userId: string): Promise<void>;
}

export interface AccountDependencies {
    lists: Pick<ListRepository, 'deleteOwnedBy' | 'removeMemberEverywhere'>;
    recipes: Pick<RecipeRepository, 'findOwnedBy' | 'getAll' | 'deleteOwnedBy' | 'removeMemberEverywhere'>;
    todos: Pick<TodoRepository, 'deleteOwnedBy' | 'removeMemberEverywhere'>;
    mealPlans: Pick<MealPlanRepository, 'deleteOwnedBy' | 'removeMemberEverywhere'>;
    labels: Pick<LabelRepository, 'deleteOwnedBy'>;
    pushSubscriptions: Pick<PushSubscriptionRepository, 'deleteByUserId'>;
    friends: Pick<FriendRepository, 'deleteAllForUser'>;
    invites: Pick<ListInviteRepository, 'eraseUser'>;
    publications: Pick<DiscoveryPublicationRepository, 'listAllByOwner' | 'deleteByLibraryId'>;
    reports: Pick<DiscoveryReportRepository, 'deleteByReporterId' | 'deleteByRecipeId'>;
    discovery: Pick<DiscoveryService, 'getRecipes' | 'remove'>;
    images: ObjectEraser;
    credentials: CredentialsEraser;
    /** Closes whatever live connections the user still has (list sockets). */
    disconnect: (userId: string) => void;
}

const RECIPE_UPLOAD_PREFIX = 'recipe-upload';
const AI_IMAGE_PREFIX = 'recipe-image/';
const PUBLIC_COVER_PREFIX = 'discovery-image';

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

/**
 * Deletes a person's Tandra account and everything tied to them.
 *
 * Their Discover publications are removed (not anonymised): the recipe text is their own work, and a public copy
 * whose owner is gone could no longer be unpublished or corrected by anyone. People who already copied one keep
 * their own copy, as the licence allows.
 *
 * The sign-in rows go last. A failure part-way leaves the session intact, so the same request can simply be
 * repeated, and every step is safe to run again, so a repeat (or a second request at the same time) changes nothing.
 */
export class AccountService {
    constructor(
        private readonly deps: AccountDependencies,
        private readonly logger?: Logger
    ) {}

    /** Deletes `user`'s account once they have typed their own username; any other text is a 403 and nothing is touched. */
    async deleteAccount(user: User, typedUsername: string): Promise<void> {
        if (typedUsername !== user.username) {
            throw fail('The username you typed does not match your account', 403);
        }

        await this.erase(user.id);
        this.logger?.info('Account deleted', { userId: user.id });
    }

    private async erase(userId: string): Promise<void> {
        const { lists, recipes, todos, mealPlans, labels, pushSubscriptions, friends, invites } = this.deps;

        await this.removePublications(userId);
        await this.deps.reports.deleteByReporterId(userId);
        await this.removeOwnedRecipes(userId);

        await Promise.all([
            lists.deleteOwnedBy(userId),
            todos.deleteOwnedBy(userId),
            mealPlans.deleteOwnedBy(userId),
            labels.deleteOwnedBy(userId),
        ]);

        // Whatever is left with the user in `users[]` belongs to somebody else and stays with them.
        await Promise.all([
            lists.removeMemberEverywhere(userId),
            recipes.removeMemberEverywhere(userId),
            todos.removeMemberEverywhere(userId),
            mealPlans.removeMemberEverywhere(userId),
        ]);

        await Promise.all([
            friends.deleteAllForUser(userId),
            pushSubscriptions.deleteByUserId(userId),
            invites.eraseUser(userId),
        ]);

        this.deps.disconnect(userId);
        await this.deps.credentials.eraseCredentials(userId);
    }

    // The library recipe and its public cover copy go together; the publication row, which is how a half-done
    // erasure finds them again, is the last thing removed.
    private async removePublications(userId: string): Promise<void> {
        const { publications, discovery, images, reports } = this.deps;
        const owned = await publications.listAllByOwner(userId);

        if (owned.length === 0) return;

        const libraryIds = owned.map((publication) => publication.libraryId);

        const covers = (await discovery.getRecipes(libraryIds)).flatMap((recipe) =>
            recipe.coverImageKey ? [recipe.coverImageKey] : []
        );

        for (const libraryId of libraryIds) await discovery.remove(libraryId);

        const copies = await Promise.all(libraryIds.map((id) => images.listKeys(`${PUBLIC_COVER_PREFIX}/${id}/`)));
        await images.removeKeys([...new Set([...covers, ...copies.flat()])]);

        for (const libraryId of libraryIds) {
            await reports.deleteByRecipeId(libraryId);
            await publications.deleteByLibraryId(libraryId);
        }
    }

    // Files first, rows after: a failure then leaves the recipes in place for the retry to find their images.
    private async removeOwnedRecipes(userId: string): Promise<void> {
        const { recipes, images } = this.deps;
        const uploadPrefix = `${RECIPE_UPLOAD_PREFIX}/${userId}/`;

        // A cover can also be a library or item image that other people still use; only the user's own files go.
        const own = (key: string | undefined): key is string =>
            key !== undefined && (key.startsWith(uploadPrefix) || key.startsWith(AI_IMAGE_PREFIX));

        const owned = await recipes.findOwnedBy(userId);
        const ownedIds = new Set(owned.map((recipe) => recipe.id));

        const keys = new Set(
            owned.flatMap((recipe) =>
                [`${AI_IMAGE_PREFIX}${recipe.id}.webp`, recipe.coverImageKey, recipe.aiImageKey].filter(own)
            )
        );

        // Old recipe copies could share an AI key. Their content stays theirs until the final reference goes.
        for (const other of await recipes.getAll()) {
            if (ownedIds.has(other.id)) continue;

            if (other.aiImageKey?.startsWith(AI_IMAGE_PREFIX)) keys.delete(other.aiImageKey);

            if (other.coverImageKey?.startsWith(AI_IMAGE_PREFIX)) keys.delete(other.coverImageKey);
        }

        await images.removeKeys([...new Set([...keys, ...(await images.listKeys(uploadPrefix))])]);
        await recipes.deleteOwnedBy(userId);
    }
}
