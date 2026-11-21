import { useCallback, useState } from 'react';

import { loadTracker, startReplay, stopReplay } from '../utils/analytics';
import {
    hasReplayConsent,
    isUsageOptedOut,
    markConsentPromptSeen,
    setReplayConsent,
    setUsageOptedOut,
} from '../utils/analyticsConsent';

interface AnalyticsConsent {
    /** Usage statistics: on unless the visitor opted out. */
    usageEnabled: boolean;
    /** Session recordings: off unless the visitor agreed. */
    recordingsEnabled: boolean;
    setUsageEnabled: (enabled: boolean) => void;
    setRecordingsEnabled: (enabled: boolean) => void;
}

/**
 * The two analytics choices (Settings toggles and the first-run prompt), remembered on this device.
 * Making either choice counts as having seen the first-run prompt.
 */
export const useAnalyticsConsent = (): AnalyticsConsent => {
    const [usageEnabled, setUsage] = useState(() => !isUsageOptedOut());
    const [recordingsEnabled, setRecordings] = useState(hasReplayConsent);

    const setUsageEnabled = useCallback((enabled: boolean) => {
        setUsageOptedOut(!enabled);
        const usageEnabled = !isUsageOptedOut();
        setUsage(usageEnabled);
        markConsentPromptSeen();

        // Opting out ends a recording already running; opting back in resumes one the visitor agreed to earlier.
        if (!usageEnabled) stopReplay();
        else {
            loadTracker();

            if (hasReplayConsent()) startReplay();
        }
    }, []);

    const setRecordingsEnabled = useCallback((enabled: boolean) => {
        setRecordings(enabled);
        setReplayConsent(enabled);
        markConsentPromptSeen();

        if (enabled) startReplay();
        else stopReplay();
    }, []);

    return { usageEnabled, recordingsEnabled, setUsageEnabled, setRecordingsEnabled };
};
