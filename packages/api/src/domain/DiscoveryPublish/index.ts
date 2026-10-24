import type { Logger } from '@imapps/api-utils';
import type { DiscoveryRecipe, Ingredient, PublishedRecipeRef, Recipe, User } from '@tandra/types';

import type { DiscoveryPublicationRepository } from '../DiscoveryPublicationRepository';
import type { DiscoveryService } from '../DiscoveryService';
import type { IdGenerator } from '../IdGenerator';
import type { ImageStore } from '../ImageService/types';
import type { RecipeService } from '../RecipeService';
import { slugify, uniqueSlug } from '../slug';
import { WIKIBOOKS_RECIPE_ID } from '../WikibooksIngest/mapping';
import { copyImage } from './copyImage';

const USER_LICENCE = 'CC-BY-SA-4.0';
const LIBRARY_ID_PREFIX = 'user-';
const COVER_PREFIX = 'discovery-image';

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

const normalised = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

const ingredientKey = (ingredients: Array<Pick<Ingredient, 'name'>>): string =>
    [...new Set(ingredients.map((ingredient) => normalised(ingredient.name)))].sort().join('|');

/** The library-relative page for a published recipe: user recipes have no external source, so the app itself is the source. */
const publicRecipePath = (libraryId: string): string => `/discover/${libraryId}`;

const attributionFor = (title: string, authorName: string | undefined): string =>
    `"${title}" by ${authorName ?? 'a Tandra user'}, CC BY-SA 4.0`;

/**
 * Publishes a user's own recipe to the shared library as a SNAPSHOT: a new `discoveryRecipes` document that carries
 * nothing of the private recipe's sharing (`users`, `ownerId`) or its id. The only link back is a server-side
 * publication row, used to unpublish and republish.
 */
export class DiscoveryPublishService {
    constructor(
        private readonly discovery: Pick<DiscoveryService, 'save' | 'remove' | 'findByTitle' | 'hasSlug'>,
        private readonly publications: DiscoveryPublicationRepository,
        private readonly recipes: Pick<RecipeService, 'getRecipe'>,
        private readonly images: ImageStore,
        private readonly idGenerator: IdGenerator,
        private readonly logger?: Logger
    ) {}

    // Ordered checks (agreement, ownership, content, duplicate) then the two-step write; each is a distinct refusal.
    // fallow-ignore-next-line complexity
    async publish(
        recipeId: string,
        user: User,
        request: { agreeToLicence?: boolean; showName?: boolean }
    ): Promise<PublishedRecipeRef> {
        if (request.agreeToLicence !== true) {
            throw fail('You must agree to share this recipe under CC BY-SA 4.0', 400);
        }
        const recipe = await this.recipes.getRecipe(recipeId);
        // Not "only recipes you can see": a recipe shared with you is not yours to publish.
        if (recipe.ownerId !== user.id) throw fail('Only the recipe owner can make it public', 403);
        this.assertPublishable(recipe);

        const existing = await this.publications.getByRecipeId(recipeId);
        const libraryId = existing?.libraryId ?? `${LIBRARY_ID_PREFIX}${this.idGenerator.generate()}`;
        await this.assertNotDuplicate(recipe, libraryId);

        // The id is stored before the library write, so a retry after a half-finished publish reuses it.
        if (!existing) await this.publications.upsert({ recipeId, libraryId, ownerId: user.id });

        const now = new Date();
        const snapshot = await this.snapshotOf(recipe, libraryId, user, request.showName === true, now);
        await this.discovery.save(snapshot);

        const publishedAt = now;
        await this.publications.upsert({ recipeId, libraryId, ownerId: user.id, publishedAt });
        this.logger?.info('Recipe published to the discovery library', { libraryId, userId: user.id });
        return { recipeId, libraryId, publishedAt };
    }

    /** Removes the caller's own publication. Unknown ids and other people's publications are both a 404. */
    async unpublish(libraryId: string, user: User): Promise<void> {
        const publication = await this.publications.getByLibraryId(libraryId);
        if (!publication || publication.ownerId !== user.id) throw fail('Published recipe not found', 404);
        // Library first, row last: if the index is down the row survives and the same call can simply be repeated.
        await this.discovery.remove(libraryId);
        await this.publications.deleteByLibraryId(libraryId);
        this.logger?.info('Recipe unpublished from the discovery library', { libraryId, userId: user.id });
    }

    async listMine(user: User): Promise<PublishedRecipeRef[]> {
        const rows = await this.publications.listPublishedByOwner(user.id);
        return rows.flatMap((row) =>
            row.publishedAt ? [{ recipeId: row.recipeId, libraryId: row.libraryId, publishedAt: row.publishedAt }] : []
        );
    }

    // Imported recipes hold somebody else's text: a recipe with a source link, or one copied from the library
    // (which carries an attribution), is never publishable. Authors who want to share it must write their own.
    // One guard per way a recipe can be unfit to publish.
    // fallow-ignore-next-line complexity
    private assertPublishable(recipe: Recipe): void {
        if (recipe.link || recipe.attribution) {
            throw fail(
                "Recipes imported from a link, or copied from Discover, can't be made public. Only recipes you wrote yourself can be shared.",
                422
            );
        }
        if (!recipe.title.trim() || recipe.ingredients.length === 0 || !recipe.instructions?.length) {
            throw fail('Add ingredients and instructions before making a recipe public', 422);
        }
    }

    private async assertNotDuplicate(recipe: Recipe, ownLibraryId: string): Promise<void> {
        const key = ingredientKey(recipe.ingredients);
        const sameTitle = await this.discovery.findByTitle(recipe.title.trim());
        const twin = sameTitle.find((other) => other.id !== ownLibraryId && ingredientKey(other.ingredients) === key);
        if (twin) throw fail('A recipe like this is already in the library', 409);
    }

    // Field-by-field snapshot with optional fields left out when unset.
    // fallow-ignore-next-line complexity
    private async snapshotOf(
        recipe: Recipe,
        libraryId: string,
        user: User,
        showName: boolean,
        now: Date
    ): Promise<DiscoveryRecipe> {
        const title = recipe.title.trim();
        const coverImageKey = await this.coverFor(recipe, libraryId);
        const authorName = showName ? user.username : undefined;
        const slug = await this.slugFor(title);
        return {
            id: libraryId,
            title,
            ingredients: recipe.ingredients.map((ingredient) => ({
                ...ingredient,
                id: this.idGenerator.generate(),
            })),
            instructions: [...(recipe.instructions ?? [])],
            tags: [...(recipe.tags ?? [])],
            ...(recipe.prepTime !== undefined && { prepTime: recipe.prepTime }),
            ...(recipe.cookTime !== undefined && { cookTime: recipe.cookTime }),
            ...(recipe.servings !== undefined && { servings: recipe.servings }),
            ...(recipe.difficulty !== undefined && { difficulty: recipe.difficulty }),
            ...(coverImageKey && { coverImageKey }),
            source: 'user',
            sourceUrl: publicRecipePath(libraryId),
            licence: USER_LICENCE,
            attribution: attributionFor(title, authorName),
            ...(authorName && { publishedBy: authorName }),
            ...(slug && { slug }),
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Resolve a unique slug for a freshly-published recipe. Tries the base
     * slug first, then `${base}-2`, ... up to a sane bound. Wikibooks recipes
     * use their id (`wikibooks-<pageId>`) as slug, so that shape is never handed
     * out here, even for a page not ingested yet: its recipe would then fail to save.
     */
    private async slugFor(title: string): Promise<string | undefined> {
        const base = slugify(title);
        const isTaken = async (candidate: string) =>
            WIKIBOOKS_RECIPE_ID.test(candidate) || (await this.discovery.hasSlug(candidate));
        try {
            return await uniqueSlug(base, isTaken);
        } catch (error) {
            this.logger?.warn('Could not allocate a unique slug for published recipe; publishing without one', {
                title,
                error: (error as Error).message,
            });
            return undefined;
        }
    }

    // A missing or unreadable cover must not stop the recipe being shared; it just goes out without one.
    private async coverFor(recipe: Recipe, libraryId: string): Promise<string | undefined> {
        if (!recipe.coverImageKey) return undefined;
        try {
            return await copyImage(this.images, recipe.coverImageKey, `${COVER_PREFIX}/${libraryId}/${Date.now()}`);
        } catch (error) {
            this.logger?.warn('Published recipe cover could not be copied; publishing without one', {
                libraryId,
                error: (error as Error).message,
            });
            return undefined;
        }
    }
}
