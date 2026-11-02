import { useCallback } from 'react';

import type { SessionUser } from '../auth';
import { track } from '../utils/analytics';
import { logger } from '../utils/logger';
import { useGuest } from './GuestContext';
import { type MigrationResult, migrateGuestToAccount } from './migrateGuestToAccount';

// Runs right after a successful login or registration. Uploads whatever the
// guest store holds (a no-op when it is empty) and drops the guest flag.
//
// It runs whether or not the guest flag is on: data only survives in the
// store when an earlier migration had list failures, and the next sign-in is
// the retry. The flag is dropped with `keepData` because the migration owns
// the store: it removes each list once uploaded and keeps the ones that failed.
// Never throws, so a failed migration can't block sign-in.

// Counts only: list titles and item names are the guest's own text. Nothing to report for an empty store.
const trackMigration = (result: MigrationResult): void => {
    if (result.listsUploaded + result.listFailures === 0) return;
    track('guest_migration_completed', {
        listsUploaded: result.listsUploaded,
        itemsUploaded: result.itemsUploaded,
        listsRenamed: result.listsRenamed,
        listFailures: result.listFailures,
    });
};

export const useMigration = () => {
    const { isGuest, exitGuestMode } = useGuest();

    const migrateAfterAuth = useCallback(
        async (user: SessionUser | null): Promise<void> => {
            try {
                if (!user) {
                    logger.warn('Cannot migrate guest data: no signed-in user after authentication');

                    return;
                }

                trackMigration(await migrateGuestToAccount({ id: user.id, username: user.username }));
            } catch (migrationError) {
                logger.error('Guest migration failed', { error: String(migrationError) });
            } finally {
                if (isGuest) exitGuestMode({ keepData: true });
            }
        },
        [isGuest, exitGuestMode]
    );

    return { migrateAfterAuth };
};
