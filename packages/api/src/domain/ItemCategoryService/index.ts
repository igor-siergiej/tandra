import type { Logger } from '@imapps/api-utils';
import type { ItemCategory } from '@tandra/types';

import type { ItemCategoryRepository } from '../ItemCategoryRepository';

export interface ItemClassifier {
    classify(name: string): Promise<ItemCategory>;
}

const normaliseItemName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

const errorMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** Classifies a shopping item name into an aisle, remembering the answer so each name is classified once ever. */
export class ItemCategoryService {
    constructor(
        private readonly repo: ItemCategoryRepository,
        private readonly classifier: ItemClassifier,
        private readonly logger?: Logger
    ) {}

    /** Returns null when classification fails; failures are never cached, so a later add retries. */
    // Called from ListService through the DI-resolved instance, which fallow can't trace.
    // fallow-ignore-next-line unused-class-member
    async categorise(name: string): Promise<ItemCategory | null> {
        const key = normaliseItemName(name);

        if (!key) return null;

        try {
            const cached = await this.repo.get(key);

            if (cached) return cached;

            const category = await this.classifier.classify(key);
            await this.repo.set(key, category);

            return category;
        } catch (error) {
            this.logger?.warn('Item categorisation failed, leaving uncategorised', {
                itemName: key,
                error: errorMessage(error),
            });

            return null;
        }
    }
}
