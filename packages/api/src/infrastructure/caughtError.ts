import { z } from 'zod';

/**
 * What the handlers and services read off a caught value. A thrown string, null or an object whose
 * fields have other types decodes to no message/status instead of leaking an unchecked shape.
 */
export const caughtErrorSchema = z
    .looseObject({
        name: z.string().optional().catch(undefined),
        message: z.string().optional().catch(undefined),
        status: z.number().optional().catch(undefined),
    })
    .catch({});

export type CaughtError = z.output<typeof caughtErrorSchema>;
