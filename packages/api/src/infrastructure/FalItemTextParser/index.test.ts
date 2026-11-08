import { describe, expect, it, vi } from 'bun:test';

import { fake } from '../../testing/fake';
import { FalItemTextParser } from './index';
import { spokenItemsSchema } from './schema';

describe('spokenItemsSchema', () => {
    it('keeps valid items and drops malformed ones instead of failing the whole reply', () => {
        const parsed = spokenItemsSchema.parse({
            items: [
                { name: 'bread', quantity: 2, unit: 'loaf' },
                { name: '' },
                'nonsense',
                { name: 'milk' },
                { name: 'eggs', quantity: 12 },
            ],
        });

        expect(parsed.items).toEqual([
            { name: 'bread', quantity: 2, unit: 'loaf' },
            { name: 'milk' },
            { name: 'eggs', quantity: 12 },
        ]);
    });

    it('ignores an unusable quantity or unit but keeps the item', () => {
        const parsed = spokenItemsSchema.parse({ items: [{ name: 'milk', quantity: -3, unit: 5 }] });

        expect(parsed.items).toEqual([{ name: 'milk' }]);
    });

    it('rejects a reply with no items array', () => {
        expect(spokenItemsSchema.safeParse({ nope: [] }).success).toBe(false);
    });
});

describe('FalItemTextParser', () => {
    it('sends the transcript and returns the parsed items', async () => {
        const client = {
            completeStructured: vi.fn().mockResolvedValue({ value: { items: [{ name: 'milk' }] } }),
        };

        const items = await new FalItemTextParser(fake(client)).parse('some milk');

        expect(items).toEqual([{ name: 'milk' }]);
        expect(client.completeStructured.mock.calls[0][0]).toMatchObject({
            operation: 'item.parse-speech',
            prompt: 'Request: some milk',
        });
    });
});
