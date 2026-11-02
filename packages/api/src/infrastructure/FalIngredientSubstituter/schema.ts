import { z } from 'zod';

import { stringArrayField } from '../zodHelpers';

export const substitutesSchema: z.ZodType<{ substitutes: string[] }> = z
    .object({ substitutes: stringArrayField() })
    .transform((result) => ({ substitutes: result.substitutes }));
