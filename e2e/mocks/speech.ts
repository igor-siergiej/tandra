import type { Page } from '@playwright/test';

declare global {
    interface Window {
        /** How many times the fake recognition was started, for specs to assert on. */
        __speechStarts?: number;
    }
}

/** What the fake recognition hands `onresult`: the subset of a SpeechRecognitionEvent the app reads. */
type FakeResultEvent = { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> };

export type FakeSpeechScript =
    | { kind: 'transcript'; transcript: string; delayMs?: number }
    | { kind: 'sessions'; transcripts: Array<string> }
    | { kind: 'error'; error: 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' }
    | { kind: 'unsupported' };

export interface FakeSpeechOptions {
    /** Leave the one-time voice notice unacknowledged so it shows before the mic opens (default: already seen). */
    showNotice?: boolean;
}

/** Replaces the Web Speech API before the page loads; Chromium cannot drive a real microphone. */
export const installFakeSpeech = async (page: Page, script: FakeSpeechScript, options: FakeSpeechOptions = {}) => {
    if (!options.showNotice) await page.addInitScript(() => localStorage.setItem('tandra.voiceAck', 'true'));
    await page.addInitScript((s: FakeSpeechScript) => {
        if (s.kind === 'unsupported') {
            Reflect.deleteProperty(window, 'SpeechRecognition');
            Reflect.deleteProperty(window, 'webkitSpeechRecognition');

            return;
        }

        class FakeRecognition {
            lang = '';
            continuous = false;
            interimResults = false;
            onresult: ((event: FakeResultEvent) => void) | null = null;
            onerror: ((event: { error: string }) => void) | null = null;
            onend: (() => void) | null = null;
            start() {
                const n = window.__speechStarts ?? 0;
                window.__speechStarts = n + 1;

                if (s.kind === 'sessions') {
                    // Each start() is one browser session: it hears the next phrase, and the browser ends it on a
                    // pause unless this is the last scripted phrase and recognition is continuous.
                    const phrase = s.transcripts[Math.min(n, s.transcripts.length - 1)];
                    setTimeout(() => {
                        this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: phrase } }] });

                        if (!this.continuous || n < s.transcripts.length - 1) this.onend?.();
                    }, 50);

                    return;
                }

                const delay = s.kind === 'transcript' ? (s.delayMs ?? 50) : 50;
                setTimeout(() => {
                    if (s.kind === 'error') {
                        this.onerror?.({ error: s.error });
                    } else if (s.kind === 'transcript') {
                        this.onresult?.({
                            resultIndex: 0,
                            results: [{ isFinal: true, 0: { transcript: s.transcript } }],
                        });
                    }

                    this.onend?.();
                }, delay);
            }
            stop() {
                this.onend?.();
            }
            abort() {}
        }

        for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
            Object.defineProperty(window, name, { configurable: true, writable: true, value: FakeRecognition });
        }
    }, script);
};
