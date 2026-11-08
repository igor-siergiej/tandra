// The Web Speech API is not in lib.dom and ships prefixed in Chromium/Safari, so it gets a minimal local typing.
export interface SpeechRecognitionResultLike {
    isFinal: boolean;
    0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: ArrayLike<SpeechRecognitionResultLike>;
}

export interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    }
}

export const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
    if (typeof window === 'undefined') return null;

    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
};
