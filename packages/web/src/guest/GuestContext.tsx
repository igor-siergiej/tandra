import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { track } from '../utils/analytics';
import { logger } from '../utils/logger';
import { GUEST_FLAG_KEY, readGuestFlag, writeGuestFlag } from './guestFlag';
import { guestStore } from './guestStore';

// A guest session lets a visitor try the app without an account. They can
// create lists and items, which are stored locally in IndexedDB; the moment
// they register or log in the data is migrated to the server (see
// `migrateGuestToAccount.ts`) and the guest store is cleared.
//
// The flag lives in localStorage (`guestFlag.ts`); the data itself lives
// in IndexedDB via `guestStore`; this context is just the on/off switch.

/** Where a visitor started guest mode: the landing site's `/try` link or the login page's button. */
export type GuestEntry = 'try_link' | 'login_page';

export interface GuestContextType {
    /** True when the visitor is in guest mode. Mutually exclusive with an authenticated session. */
    isGuest: boolean;
    /** Opt the visitor into guest mode and route them to the app. */
    enterGuestMode: (entry: GuestEntry) => void;
    /**
     * Leave guest mode. Clears the local store too, unless `keepData` is set
     * (sign-in, where the migration decides what to clear).
     */
    exitGuestMode: (options?: { keepData?: boolean }) => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const useGuest = (): GuestContextType => {
    const context = useContext(GuestContext);

    if (context === undefined) {
        throw new Error('useGuest must be used within a GuestProvider');
    }

    return context;
};

export const GuestProvider = ({ children }: { children: ReactNode }) => {
    const [isGuest, setIsGuest] = useState<boolean>(() => readGuestFlag());

    // Keep the flag in sync across tabs/windows so a guest who opens a second
    // tab lands in guest mode there too (and vice-versa for sign-out).
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== GUEST_FLAG_KEY) return;
            setIsGuest(readGuestFlag());
        };

        window.addEventListener('storage', onStorage);

        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const enterGuestMode = useCallback((entry: GuestEntry) => {
        writeGuestFlag(true);
        setIsGuest(true);
        track('guest_mode_entered', { entry });
        logger.info('Entered guest mode');
    }, []);

    const exitGuestMode = useCallback((options?: { keepData?: boolean }) => {
        // Wipe local data so the next guest session starts clean and a logged-in
        // user doesn't see a previous stranger's lists if they hand the device over.
        if (!options?.keepData) void guestStore.clear();
        writeGuestFlag(false);
        setIsGuest(false);
        logger.info('Exited guest mode');
    }, []);

    const value = useMemo<GuestContextType>(
        () => ({ isGuest, enterGuestMode, exitGuestMode }),
        [isGuest, enterGuestMode, exitGuestMode]
    );

    return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
};
