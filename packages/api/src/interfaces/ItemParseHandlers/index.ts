import { APIError } from '@imapps/api-utils/hono';
import type { Context } from 'hono';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import type { HonoVars } from '../handlerUtils';

const MAX_TRANSCRIPT_CHARS = 500;
const MAX_ITEMS = 30;

// Turns a spoken shopping request into structured items for the client to confirm; nothing is added here.
// fallow-ignore-next-line complexity
export const parseSpokenItems = async (c: Context<HonoVars>) => {
    const user = c.get('user');
    const { transcript } = await c.req.json<{ transcript: string }>();
    const logger = dependencyContainer.resolve(DependencyToken.Logger);

    try {
        const items = await dependencyContainer
            .resolve(DependencyToken.ItemTextParser)
            .parse(transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS));

        logger.info('API: Spoken items parsed', { userId: user?.id, itemCount: items.length });

        return c.json({ items: items.slice(0, MAX_ITEMS) }, 200);
    } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        logger.error('API: Failed to parse spoken items', { userId: user?.id, error: err.message });
        throw new APIError('Could not understand that request', err.status ?? 502);
    }
};
