import type { Logger } from '@imapps/api-utils';

import type { DiscoveryRecipeRepository } from '../domain/DiscoveryRecipeRepository';

/**
 * Gives every Wikibooks recipe stored before ingest set slugs its id as slug, so the public discover API can list and
 * serve it. Runs on every API start (after `ensureIndexes`) and is a no-op once the library is done. A failure only
 * keeps those recipes off the public API, so it is logged and never stops startup.
 */
export const backfillWikibooksSlugs = async (
    repository: Pick<DiscoveryRecipeRepository, 'assignWikibooksSlugs'>,
    logger: Pick<Logger, 'info' | 'warn'>
): Promise<void> => {
    try {
        const { assigned, blocked } = await repository.assignWikibooksSlugs();
        if (assigned > 0) logger.info('Gave Wikibooks recipes their public slug', { assigned });
        if (blocked.length > 0) {
            logger.warn('Wikibooks recipes left without a slug: another recipe already uses it', { blocked });
        }
    } catch (error) {
        logger.warn('Wikibooks slug backfill failed; those recipes stay off the public API until the next start', {
            error: String(error),
        });
    }
};
