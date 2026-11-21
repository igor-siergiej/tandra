/**
 * The visitor's analytics choices, kept in this browser's localStorage (nothing is stored server-side).
 *
 * - `umami.disabled`: Umami's own opt-out flag. Umami and `analytics.ts` treat any stored value as opted out,
 *   so turning usage statistics back on removes the key instead of writing "false".
 * - `tandra.replayConsent`: "true" once the visitor agreed to session recordings, "false" once they withdrew.
 * - `tandra.analyticsPromptSeen`: "true" once the first-run prompt was answered or dismissed.
 *
 * Reads stay live unless a write failed. Failed opt-outs apply for this visit; failed opt-ins stay off
 * until the SDK's persisted opt-out can be cleared.
 */

const USAGE_OPT_OUT_KEY = 'umami.disabled';
const REPLAY_CONSENT_KEY = 'tandra.replayConsent';
const PROMPT_SEEN_KEY = 'tandra.analyticsPromptSeen';

const unsavedChoices = new Map<string, string | null>();
const listeners = new Set<() => void>();

export const hasUnsavedAnalyticsChoices = (): boolean => unsavedChoices.size > 0;

export const subscribeAnalyticsStorage = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

const read = (key: string): string | null => {
    if (unsavedChoices.has(key)) return unsavedChoices.get(key) ?? null;

    try {
        return localStorage.getItem(key);
    } catch {
        // An unreadable opt-out must not enable tracking. Replay still needs explicit consent.
        return key === USAGE_OPT_OUT_KEY ? 'true' : null;
    }
};

const write = (key: string, value: string | null): void => {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
        unsavedChoices.delete(key);
    } catch {
        // Umami reads storage directly. Never report enabled while its persisted guard may still be set.
        unsavedChoices.set(key, key === USAGE_OPT_OUT_KEY && value === null ? 'true' : value);
    }

    for (const listener of listeners) listener();
};

export const isUsageOptedOut = (): boolean => Boolean(read(USAGE_OPT_OUT_KEY));

export const setUsageOptedOut = (optedOut: boolean): void => write(USAGE_OPT_OUT_KEY, optedOut ? 'true' : null);

export const hasReplayConsent = (): boolean => read(REPLAY_CONSENT_KEY) === 'true';

export const setReplayConsent = (consent: boolean): void => write(REPLAY_CONSENT_KEY, String(consent));

export const hasSeenConsentPrompt = (): boolean => read(PROMPT_SEEN_KEY) === 'true';

export const markConsentPromptSeen = (): void => write(PROMPT_SEEN_KEY, 'true');
