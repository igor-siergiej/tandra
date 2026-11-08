import { z } from 'zod';

/**
 * What the UI reads off a caught value or a query error. Anything that is not an object, or whose
 * fields have other types, decodes to no message/status instead of leaking an unchecked shape.
 */
export const caughtErrorSchema = z
    .looseObject({
        message: z.string().optional().catch(undefined),
        status: z.number().optional().catch(undefined),
    })
    .catch({});
