import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getListSocketTicket } from '../api';
import { openListSocket, type Viewer } from '../realtime/listSocket';

// Keeps the open list in sync with other members' edits and reports who else has it open.
// Events carry no state: a change just invalidates the list query, so the outbox fold still
// applies to whatever the refetch returns.
export const useListRealtime = (listTitle: string | undefined, currentUserId: string | undefined): Viewer[] => {
    const queryClient = useQueryClient();
    const [viewers, setViewers] = useState<Viewer[]>([]);

    useEffect(() => {
        if (!listTitle) return;

        const close = openListSocket({
            listTitle,
            getTicket: getListSocketTicket,
            onChanged: () => void queryClient.invalidateQueries({ queryKey: [listTitle] }),
            onPresence: setViewers,
        });

        return () => {
            close();
            setViewers([]);
        };
    }, [listTitle, queryClient]);

    return viewers.filter((viewer) => viewer.id !== currentUserId);
};
