import { z } from 'zod';

export interface ParsedShoppingItem {
    name: string;
    quantity?: number;
    unit?: string;
}

const item = z.object({
    name: z.string().trim().min(1),
    quantity: z.number().positive().optional().catch(undefined),
    unit: z.string().trim().min(1).optional().catch(undefined),
});

const { $schema: _dialect, ...itemJsonSchema } = z.toJSONSchema(item, { io: 'input', unrepresentable: 'any' });

// One malformed entry must not discard the rest of what the person said. Entries are validated one by one below, so
// the array itself is `unknown`; the JSON schema sent to the model still describes each entry.
export const spokenItemsSchema: z.ZodType<{ items: ParsedShoppingItem[] }> = z
    .object({ items: z.array(z.unknown()).meta({ items: itemJsonSchema }) })
    .transform(({ items }) => ({
        items: items.flatMap((entry) => {
            const parsed = item.safeParse(entry);

            return parsed.success ? [parsed.data as ParsedShoppingItem] : [];
        }),
    }));
