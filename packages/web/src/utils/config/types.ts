import { z } from 'zod';

export const appConfigSchema = z.looseObject({
    /**
     * Self-hosted Umami analytics (jott #72, #138). `host` is the base URL the
     * tracker script `p.js` is served under (production: same-origin
     * `https://app.tandra.uk/pulse`). The web app is a no-op tracker when
     * `enabled` is `false` or the fields are missing — selfhost/.env.example
     * documents how to turn it on.
     */
    analytics: z
        .object({
            host: z.string().optional().catch(undefined),
            websiteId: z.string().optional().catch(undefined),
            enabled: z.boolean().optional().catch(undefined),
        })
        .optional()
        .catch(undefined),
});

export type AppConfig = z.output<typeof appConfigSchema>;

export interface ConfigState {
    config: AppConfig | null;
    isLoading: boolean;
    error: string | null;
}
