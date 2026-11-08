import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { hasInAppBackHistory } from '../utils/navigationHistory';

// Prefer a real back-navigation (pops the actual history entry) so the
// hardware/browser back button stays in sync with this button. Only falls
// back to a hardcoded destination when there's no in-app history to pop
// into (fresh page load, deep link, PWA shortcut, notification tap).
export const useGoBack = (fallbackPath: string): (() => void) => {
    const navigate = useNavigate();

    return useCallback(() => {
        if (hasInAppBackHistory()) {
            navigate(-1);
        } else {
            navigate(fallbackPath, { replace: true });
        }
    }, [navigate, fallbackPath]);
};
