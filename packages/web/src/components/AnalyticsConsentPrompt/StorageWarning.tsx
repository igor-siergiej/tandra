import { useSyncExternalStore } from 'react';

import { hasUnsavedAnalyticsChoices, subscribeAnalyticsStorage } from '../../utils/analyticsConsent';

export const AnalyticsStorageWarning = () => {
    const unsaved = useSyncExternalStore(subscribeAnalyticsStorage, hasUnsavedAnalyticsChoices);

    if (!unsaved) return null;

    return (
        <p role="alert" className="text-xs text-muted-foreground">
            We could not save your privacy choices in this browser. Usage statistics stays off if it cannot be enabled.
            Other unsaved choices apply only for this visit. Check Settings again after refreshing.
        </p>
    );
};
