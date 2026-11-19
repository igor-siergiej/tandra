/**
 * The visitor's analytics choices, kept in this browser's localStorage (nothing is stored server-side).
 *
 * - `umami.disabled`: Umami's own opt-out flag. Umami and `analytics.ts` treat any stored value as opted out,
 *   so turning usage statistics back on removes the key instead of writing "false".
 * - `tandra.replayConsent`: "true" once the visitor agreed to session recordings, "false" once they withdrew.
 * - `tandra.analyticsPromptSeen`: "true" once the first-run prompt was answered or dismissed.
 *
 * Every read is live (no cache) so a choice made in Settings applies on the next call, with no reload.
 */

const USAGE_OPT_OUT_KEY = 'umami.disabled';
const REPLAY_CONSENT_KEY = 'tandra.replayConsent';
const PROMPT_SEEN_KEY = 'tandra.analyticsPromptSeen';

const read = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const write = (key: string, value: string | null): void => {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Storage unavailable (private mode): the choice just lasts for this visit.
    }
};

export const isUsageOptedOut = (): boolean => Boolean(read(USAGE_OPT_OUT_KEY));

export const setUsageOptedOut = (optedOut: boolean): void => write(USAGE_OPT_OUT_KEY, optedOut ? 'true' : null);

export const hasReplayConsent = (): boolean => read(REPLAY_CONSENT_KEY) === 'true';

export const setReplayConsent = (consent: boolean): void => write(REPLAY_CONSENT_KEY, String(consent));

export const hasSeenConsentPrompt = (): boolean => read(PROMPT_SEEN_KEY) === 'true';

export const markConsentPromptSeen = (): void => write(PROMPT_SEEN_KEY, 'true');
