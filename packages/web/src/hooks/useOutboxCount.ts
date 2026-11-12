import { useSyncExternalStore } from 'react';

import { outboxStore } from '../offline/outboxStore';

export const useOutboxCount = (): number =>
    useSyncExternalStore(
        (cb) => outboxStore.subscribe(cb),
        () => outboxStore.count(),
        () => 0
    );
