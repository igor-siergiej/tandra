import { useCallback, useEffect, useRef, useState } from 'react';

import { getSpeechRecognition, type SpeechRecognitionLike } from '../utils/speechRecognition';

const ERROR_MESSAGES: Record<string, string> = {
    'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to use voice.',
    'service-not-allowed': 'Microphone access was blocked. Allow it in your browser settings to use voice.',
    'no-speech': "I didn't hear anything. Try again.",
    'audio-capture': 'No microphone was found.',
    network: 'Speech recognition needs a connection. Try again when you are online.',
};

export interface UseSpeechRecognition {
    supported: boolean;
    listening: boolean;
    transcript: string;
    error: string | null;
    start: () => void;
    stop: () => void;
    reset: () => void;
}

export interface UseSpeechRecognitionOptions {
    lang?: string;
    /** Keep dictating through pauses until stop() is called, instead of ending at the first silence. */
    keepListening?: boolean;
}

export const useSpeechRecognition = ({
    lang = navigator.language || 'en-US',
    keepListening = false,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognition => {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const stoppedByUserRef = useRef(false);
    const transcriptRef = useRef('');
    // Text from sessions the browser ended on its own; a restarted session reports results from index 0 again.
    const committedRef = useRef('');
    const supported = getSpeechRecognition() !== null;

    useEffect(() => () => recognitionRef.current?.abort(), []);

    const start = useCallback(() => {
        const Ctor = getSpeechRecognition();
        if (!Ctor) return;

        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.continuous = keepListening;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
            const heard = Array.from(event.results)
                .map((result) => result[0].transcript)
                .join(' ')
                .trim();
            const next = [committedRef.current, heard].filter(Boolean).join(' ');
            transcriptRef.current = next;
            setTranscript(next);
        };
        recognition.onerror = (event) => {
            stoppedByUserRef.current = true;
            setError(ERROR_MESSAGES[event.error] ?? 'Voice input failed. Try again.');
            setListening(false);
        };
        recognition.onend = () => {
            if (keepListening && !stoppedByUserRef.current) {
                committedRef.current = transcriptRef.current;
                try {
                    recognition.start();
                    return;
                } catch {
                    // Could not restart; fall through and end the session.
                }
            }
            setListening(false);
        };

        recognitionRef.current = recognition;
        stoppedByUserRef.current = false;
        committedRef.current = '';
        transcriptRef.current = '';
        setTranscript('');
        setError(null);
        setListening(true);
        recognition.start();
    }, [lang, keepListening]);

    const stop = useCallback(() => {
        stoppedByUserRef.current = true;
        recognitionRef.current?.stop();
    }, []);

    const reset = useCallback(() => {
        stoppedByUserRef.current = true;
        recognitionRef.current?.abort();
        setListening(false);
        setTranscript('');
        setError(null);
    }, []);

    return { supported, listening, transcript, error, start, stop, reset };
};
