import { z } from 'zod';

const toStringArray = (value: Array<unknown> | undefined): string[] =>
    (value ?? []).filter((entry): entry is string => typeof entry === 'string');

// Lenient on input (non-strings are dropped), but the JSON schema sent to the model says "array of strings".
export const stringArrayField = () =>
    z
        .preprocess((value) => (Array.isArray(value) ? value : []), z.array(z.unknown()).transform(toStringArray))
        .meta({ type: 'array', items: { type: 'string' } });
