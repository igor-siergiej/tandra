import { describe, expect, it, vi } from 'bun:test';

import type { WikibooksSlugBackfill } from '../domain/DiscoveryRecipeRepository';
import { backfillWikibooksSlugs } from './wikibooksSlugs';

const setup = (outcome: () => Promise<WikibooksSlugBackfill>) => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const repository = { assignWikibooksSlugs: vi.fn(outcome) };
    return { logger, repository };
};

describe('backfillWikibooksSlugs', () => {
    it('logs how many recipes got a slug', async () => {
        const { logger, repository } = setup(async () => ({ assigned: 3712, blocked: [] }));
        await backfillWikibooksSlugs(repository, logger);
        expect(logger.info).toHaveBeenCalledWith('Gave Wikibooks recipes their public slug', { assigned: 3712 });
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stays quiet once every recipe has its slug', async () => {
        const { logger, repository } = setup(async () => ({ assigned: 0, blocked: [] }));
        await backfillWikibooksSlugs(repository, logger);
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns about recipes whose slug another recipe already owns', async () => {
        const { logger, repository } = setup(async () => ({ assigned: 2, blocked: ['wikibooks-3'] }));
        await backfillWikibooksSlugs(repository, logger);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('left without a slug'), {
            blocked: ['wikibooks-3'],
        });
    });

    it('never throws, so a failed backfill cannot stop the API starting', async () => {
        const { logger, repository } = setup(async () => {
            throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
        });
        await expect(backfillWikibooksSlugs(repository, logger)).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('backfill failed'), {
            error: 'Error: E11000 duplicate key error',
        });
    });
});
