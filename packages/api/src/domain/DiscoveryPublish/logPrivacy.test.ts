import { describe, expect, it } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { Recipe, User } from '@tandra/types';

import { DiscoveryPublishService } from './index';

// The privacy notice promises logs hold no recipe text: the title of a recipe being published must not be logged.
const TITLE = 'Quokkafest Stew Title';

const owner: User = { id: 'u-owner', username: 'owner-name' };

const recipe: Recipe = {
    id: 'recipe-1',
    title: TITLE,
    ingredients: [{ id: 'i1', name: 'Dragonfruit' }],
    instructions: ['Simmer.'],
    ownerId: owner.id,
    users: [owner],
    dateAdded: new Date(0),
};

const objectEraser = { listKeys: async (): Promise<string[]> => [], removeKeys: async () => {} };

describe('DiscoveryPublishService logging', () => {
    it('should log no recipe title when a unique slug cannot be allocated', async () => {
        const calls: Array<unknown[]> = [];
        const record = (...args: unknown[]) => calls.push(args);
        const logger = { info: record, warn: record, error: record, debug: record } as unknown as Logger;

        const service = new DiscoveryPublishService(
            {
                save: async () => {},
                remove: async () => {},
                findByTitle: async () => [],
                // Every candidate slug is taken, so allocation gives up and the recipe is published without one.
                hasSlug: async () => true,
            },
            {
                getByRecipeId: async (): Promise<null> => null,
                upsert: async () => {},
            } as never,
            { getRecipe: async () => recipe },
            {} as never,
            { generate: () => 'generated-id' },
            objectEraser,
            logger
        );

        await service.publish(recipe.id, owner, { agreeToLicence: true });

        expect(calls.length).toBeGreaterThan(0);
        expect(JSON.stringify(calls).toLowerCase()).not.toContain('quokkafest');
    });
});
