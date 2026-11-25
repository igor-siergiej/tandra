import { describe, expect, it, vi } from 'bun:test';

import type { Logger } from '@imapps/api-utils';
import type { ItemCategory } from '@tandra/types';

import { ItemCategoryService } from './index';

// The privacy notice promises logs hold no list-item text: an item the classifier failed on must not be logged.
const ITEM_NAME = 'Dragonfruit Item Name';

describe('ItemCategoryService logging', () => {
    it('should log no item name when classification fails', async () => {
        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

        const service = new ItemCategoryService(
            { ensureIndexes: vi.fn(), get: vi.fn().mockResolvedValue(null), set: vi.fn() },
            { classify: vi.fn().mockRejectedValue(new Error('classifier down')) as () => Promise<ItemCategory> },
            logger as unknown as Logger
        );

        await expect(service.categorise(ITEM_NAME)).resolves.toBeNull();

        expect(logger.warn).toHaveBeenCalled();
        expect(JSON.stringify(logger.warn.mock.calls).toLowerCase()).not.toContain('dragonfruit');
    });
});
