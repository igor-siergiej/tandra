import { describe, expect, it, vi } from 'bun:test';

import { fake } from '../../testing/fake';
import { FalItemCategoriser } from './index';
import { categorySchema } from './schema';

describe('FalItemCategoriser', () => {
    it('returns the category from the structured reply', async () => {
        const client = { completeStructured: vi.fn().mockResolvedValue({ value: { category: 'bakery' } }) };

        expect(await new FalItemCategoriser(fake(client)).classify('bread')).toBe('bakery');
        expect(client.completeStructured.mock.calls[0][0]).toMatchObject({
            operation: 'item.categorise',
            prompt: 'Item: bread',
        });
    });

    it('rejects categories outside the fixed set', () => {
        expect(categorySchema.safeParse({ category: 'frozen' }).success).toBe(true);
        expect(categorySchema.safeParse({ category: 'snacks' }).success).toBe(false);
    });
});
