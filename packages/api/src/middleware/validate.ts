import type { Context, Next } from 'hono';
import type { ZodType } from 'zod';

/**
 * Rejects a request whose JSON body does not match `schema` with 400 and a field-by-field message map. It only
 * validates: handlers still read the raw body, so valid requests behave exactly as before. With `optional`, a
 * missing or unparsable body is treated as an empty object (routes whose body is entirely optional).
 */
export const validateJson =
    (schema: ZodType, options: { optional?: boolean } = {}) =>
    // Parse, validate and format errors in one linear flow.
    // fallow-ignore-next-line complexity
    async (c: Context, next: Next) => {
        let body: unknown;

        try {
            body = await c.req.json();
        } catch {
            if (!options.optional) return c.json({ error: 'Request body must be valid JSON' }, 400);
            body = {};
        }

        const result = schema.safeParse(body);

        if (!result.success) {
            const fields: Record<string, string> = {};

            for (const issue of result.error.issues) {
                fields[issue.path.join('.') || '(body)'] ??= issue.message;
            }

            const [first] = result.error.issues;
            const where = first.path.length > 0 ? `${first.path.join('.')}: ` : '';

            return c.json({ error: `${where}${first.message}`, fields }, 400);
        }

        return next();
    };
