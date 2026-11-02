import type { QueryClient } from '@tanstack/react-query';

import { outboxStore } from './outboxStore';

const API_CACHE_NAME = 'api-cache';

// Everything the app keeps on the device on a user's behalf: the service worker's cached API responses, the
// unsent offline queue and the in-memory query cache. Run on explicit logout so the next user on a shared
// device cannot see (or replay) the previous user's data.
export const clearUserData = async (queryClient: QueryClient): Promise<void> => {
    queryClient.clear();
    await Promise.allSettled([
        typeof caches === 'undefined' ? Promise.resolve(false) : caches.delete(API_CACHE_NAME),
        outboxStore.clear(),
    ]);
};
