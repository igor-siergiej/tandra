import { useEffect } from 'react';

import { useUser } from '../auth';
import { registerWebMcpTools } from '../webmcp/registerTools';

/** Offers the shopping tools to browser agents while a user is signed in, and withdraws them on sign-out. */
export const useWebMcpTools = () => {
    const { user } = useUser();
    const userId = user?.id;

    useEffect(() => {
        if (!userId) return;

        return registerWebMcpTools(userId);
    }, [userId]);
};
