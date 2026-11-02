import { useMemo, useSyncExternalStore } from 'react';

import { outboxStore } from '../offline/outboxStore';

const EMPTY: ReadonlySet<string> = new Set();

// Item ids in `listTitle` that still have an unreplayed outbox intent. The outbox mirror is
// replaced (never mutated) on every change, so its identity is a stable snapshot.
export const usePendingItemIds = (listTitle: string): ReadonlySet<string> => {
    const intents = useSyncExternalStore(
        (cb) => outboxStore.subscribe(cb),
        () => outboxStore.peekAll(),
        () => []
    );

    return useMemo(() => {
        const ids = intents.filter((i) => i.entityType === 'item' && i.scope === listTitle).map((i) => i.targetId);
        return ids.length === 0 ? EMPTY : new Set(ids);
    }, [intents, listTitle]);
};
