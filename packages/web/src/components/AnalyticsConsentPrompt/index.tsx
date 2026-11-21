import { useState } from 'react';

import { useGuest } from '../../guest/GuestContext';
import { useAnalyticsConsent } from '../../hooks/useAnalyticsConsent';
import { isAnalyticsConfigured } from '../../utils/analytics';
import { hasSeenConsentPrompt, isUsageOptedOut, markConsentPromptSeen } from '../../utils/analyticsConsent';
import { Button } from '../ui/button';
import { AnalyticsStorageWarning } from './StorageWarning';

/**
 * One-time ask for session recordings, shown to a signed-in user who has not answered it yet. Only when the
 * tracker is set up and usage statistics are still on (an opted-out visitor records nothing to ask about).
 * Either button, or any change to the Settings toggles, counts as answered; the same toggles change it later.
 */
export const AnalyticsConsentPrompt = () => {
    const { isGuest } = useGuest();
    const { setRecordingsEnabled } = useAnalyticsConsent();

    const [visible, setVisible] = useState(
        () => !hasSeenConsentPrompt() && isAnalyticsConfigured() && !isUsageOptedOut()
    );

    if (isGuest) return null;

    if (!visible) return <AnalyticsStorageWarning />;

    const answer = (allow: boolean) => {
        if (allow) setRecordingsEnabled(true);
        else markConsentPromptSeen();
        setVisible(false);
    };

    return (
        <section aria-label="Analytics choice" className="space-y-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Help improve Tandra?</h2>
                <p className="text-xs text-muted-foreground">
                    Allow session recordings of how you use the app, so we can spot what is confusing. You can change
                    this any time in Settings.
                </p>
            </div>
            <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => answer(true)}>
                    Allow recordings
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => answer(false)}>
                    No thanks
                </Button>
            </div>
        </section>
    );
};
