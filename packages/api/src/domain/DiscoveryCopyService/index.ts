import { randomUUID } from 'node:crypto';

import type { Logger } from '@imapps/api-utils';
import type { Recipe, User } from '@tandra/types';

import { copyImage } from '../DiscoveryPublish/copyImage';
import type { DiscoveryService } from '../DiscoveryService';
import type { ImageStore } from '../ImageService/types';
import type { RecipeService } from '../RecipeService';

/**
 * Turns a library recipe into one of the caller's own recipes. The copy goes through `RecipeService.createRecipe`, so
 * ownership, tagging and `users` scoping are exactly those of any recipe the user creates; the library document is only
 * read. The copy keeps the source page as `link` and the licence `attribution`, which CC BY-SA requires.
 *
 * The library's `coverImageKey` is never referenced: a key owned by the library stops being served the moment the
 * recipe is unpublished or delisted. The cover is copied to the user's own key instead, so the copy keeps its picture.
 */
export class DiscoveryCopyService {
    constructor(
        private readonly discovery: Pick<DiscoveryService, 'getRecipe'>,
        private readonly recipes: Pick<RecipeService, 'createRecipe' | 'getRecipesByUserId' | 'setCoverImageKey'>,
        private readonly images: ImageStore,
        private readonly logger?: Logger
    ) {}

    // Duplicate check, cover copy with its credit, then the create.
    // fallow-ignore-next-line complexity
    async copyToPersonal(libraryId: string, owner: User): Promise<Recipe> {
        const library = await this.discovery.getRecipe(libraryId);

        // The page link is what ties a copy to its source, so the same page twice is a duplicate, not a second recipe.
        const mine = await this.recipes.getRecipesByUserId(owner.id);

        if (mine.some((recipe) => recipe.link === library.sourceUrl)) {
            throw Object.assign(new Error('This recipe is already in your recipes'), { status: 409 });
        }

        // The cover is copied first so its credit can travel with it, but only when there really is a cover to credit.
        const id = library.coverImageKey ? randomUUID() : undefined;

        const coverKey = library.coverImageKey
            ? await this.copyCover(library.coverImageKey, owner, id as string)
            : undefined;

        const credit = coverKey && library.coverImageAttribution ? ` ${library.coverImageAttribution}.` : '';

        const created = await this.recipes.createRecipe(
            library.title,
            library.ingredients,
            owner.id,
            owner,
            library.sourceUrl,
            library.instructions,
            // An explicit empty list: the default would share the copy with every friend.
            [],
            id,
            library.tags,
            library.prepTime,
            library.cookTime,
            library.servings,
            library.difficulty,
            `${library.attribution}${credit}`
        );

        return coverKey ? this.recipes.setCoverImageKey(created.id, coverKey, owner.id) : created;
    }

    // A cover that cannot be copied leaves the copy without one (the app generates one); it never fails the add.
    private async copyCover(libraryKey: string, owner: User, recipeId: string): Promise<string | undefined> {
        try {
            return await copyImage(this.images, libraryKey, `recipe-upload/${owner.id}/${recipeId}/${Date.now()}`);
        } catch (error) {
            this.logger?.warn('Library cover could not be copied to the new recipe', {
                recipeId,
                error: (error as Error).message,
            });

            return undefined;
        }
    }
}
