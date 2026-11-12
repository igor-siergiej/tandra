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

// One malformed entry must not discard the rest of what the person said.
export const spokenItemsSchema: z.ZodType<{ items: ParsedShoppingItem[] }> = z
    .object({ items: z.array(z.unknown()) })
    .transform(({ items }) => ({
        items: items.flatMap((entry) => {
            const parsed = item.safeParse(entry);

            return parsed.success ? [parsed.data as ParsedShoppingItem] : [];
        }),
    }));
