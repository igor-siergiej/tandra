import type { Page } from '@playwright/test';

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
        const w = window as unknown as Record<string, unknown>;
        if (s.kind === 'unsupported') {
            delete w.SpeechRecognition;
            delete w.webkitSpeechRecognition;
            return;
        }
        class FakeRecognition {
            lang = '';
            continuous = false;
            interimResults = false;
            onresult: ((event: unknown) => void) | null = null;
            onerror: ((event: { error: string }) => void) | null = null;
            onend: (() => void) | null = null;
            start() {
                const w2 = window as unknown as { __speechStarts?: number };
                const n = w2.__speechStarts ?? 0;
                w2.__speechStarts = n + 1;
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
        w.SpeechRecognition = FakeRecognition;
        w.webkitSpeechRecognition = FakeRecognition;
    }, script);
};
