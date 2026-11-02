import { z } from 'zod';

const toStringArray = (value: Array<unknown> | undefined): string[] =>
    (value ?? []).flatMap((entry) => {
        const text = z.string().safeParse(entry);

        return text.success ? [text.data] : [];
    });

export const stringArrayField = () =>
    z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(z.unknown()).transform(toStringArray));
