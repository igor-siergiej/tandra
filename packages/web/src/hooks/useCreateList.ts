import type { ListResponse, ListType, User } from '@tandra/types';
import { useQueryClient } from '@tanstack/react-query';

import { logger } from '../utils/logger';
import { useListSource } from './useListSource';

export const useCreateList = (user: User | undefined) => {
    const queryClient = useQueryClient();
    const source = useListSource();

    return async (title: string, listType: ListType, selectedUsers: string[]) => {
        if (!user) {
            logger.warn('Attempted to add list without user');

            return;
        }

        const existing = queryClient.getQueryData<Array<{ title: string }>>(['lists', user.id]) ?? [];

        if (existing.some((list) => list.title.trim().toLowerCase() === title.toLowerCase())) {
            throw new Error('A list with that name already exists');
        }

        const id = crypto.randomUUID();
        queryClient.setQueryData<ListResponse[]>(['lists', user.id], (old) => [
            ...(old ?? []),
            { id, title, dateAdded: new Date(), items: [], users: [user], listType, ownerId: user.id },
        ]);
        await source.createList({ id, title, listType, selectedUsers, user });
        logger.info('List create queued', { listTitle: title, listType });
    };
};
