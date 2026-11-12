import type { Logger } from '@imapps/api-utils';
import type { Ingredient } from '@tandra/types';

import { withImageExtension } from '../../infrastructure/objectKey';
import type { ImageGenerator, ImageStore } from '../ImageService/types';

export class RecipeImageService {
    constructor(
        private readonly store: ImageStore,
        private readonly generator: ImageGenerator,
        private readonly logger?: Logger
    ) {}

    async generateRecipeImage(
        recipeId: string,
        title: string,
        ingredients: Ingredient[],
        force = false
    ): Promise<string> {
        // Keyed by recipe id so each recipe owns a unique, immutable AI image (no cross-recipe sharing).
        // AI images are always WebP, so the key carries a fixed .webp extension.
        const key = withImageExtension(`recipe-image/${recipeId}`, 'image/webp');

        if (!force) {
            try {
                await this.store.getHeadObject(key);
                this.logger?.info('Recipe image already exists in store', { recipeId });

                return key;
            } catch {
                this.logger?.info('Recipe image not found in store, generating', { recipeId });
            }
        }

        const prompt = this.generatePrompt(title, ingredients);
        const { buffer, contentType } = await this.generator.generateImage(prompt);

        this.logger?.info('Recipe image generated', { recipeId, contentType });

        await this.store.putObject(key, buffer, { contentType });

        return key;
    }

    private generatePrompt(title: string, ingredients: Ingredient[]): string {
        const top = ingredients
            .slice(0, 5)
            .map((i) => i.name)
            .join(', ');

        const clause = top ? `, featuring ${top}` : '';

        return `Appetising food photography of ${title}${clause}, soft natural lighting, shallow depth of field, served on a wooden table, no text, no watermark.`;
    }
}
