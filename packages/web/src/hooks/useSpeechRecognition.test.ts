import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import type { SpeechRecognitionLike } from '../utils/speechRecognition';
import { useSpeechRecognition } from './useSpeechRecognition';

let instance: SpeechRecognitionLike & { started: boolean; startCount: number; aborted: boolean };

class FakeRecognition {
    lang = '';
    continuous = true;
    interimResults = false;
    onresult: SpeechRecognitionLike['onresult'] = null;
    onerror: SpeechRecognitionLike['onerror'] = null;
    onend: SpeechRecognitionLike['onend'] = null;
    started = false;
    startCount = 0;
    aborted = false;
    constructor() {
        instance = this as never;
    }
    start() {
        this.started = true;
        this.startCount += 1;
    }
    stop() {
        this.onend?.();
    }
    abort() {
        this.aborted = true;
    }
}

const phrase = (transcript: string) => ({ isFinal: true, 0: { transcript } });

describe('useSpeechRecognition', () => {
    beforeEach(() => {
        (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    });

    afterEach(() => {
        delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    });

    it('reports unsupported when the browser has no speech recognition', () => {
        delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

        expect(renderHook(() => useSpeechRecognition()).result.current.supported).toBe(false);
    });

    it('listens, exposes the live transcript and stops', () => {
        const { result } = renderHook(() => useSpeechRecognition({ lang: 'en-GB' }));

        act(() => result.current.start());
        expect(instance.started).toBe(true);
        expect(instance.lang).toBe('en-GB');
        expect(result.current.listening).toBe(true);

        act(() => instance.onresult?.({ resultIndex: 0, results: [phrase('two loaves'), phrase('of bread')] }));
        expect(result.current.transcript).toBe('two loaves of bread');

        act(() => result.current.stop());
        expect(result.current.listening).toBe(false);
    });

    it('turns a blocked microphone into a readable message', () => {
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        act(() => instance.onerror?.({ error: 'not-allowed' }));

        expect(result.current.error).toMatch(/Microphone access was blocked/);
        expect(result.current.listening).toBe(false);
    });

    it('ends at the first pause by default', () => {
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        expect(instance.continuous).toBe(false);

        act(() => instance.onend?.());
        expect(result.current.listening).toBe(false);
        expect(instance.startCount).toBe(1);
    });

    describe('keepListening', () => {
        it('restarts when the browser ends the session and keeps the earlier text', () => {
            const { result } = renderHook(() => useSpeechRecognition({ keepListening: true }));

            act(() => result.current.start());
            expect(instance.continuous).toBe(true);
            act(() => instance.onresult?.({ resultIndex: 0, results: [phrase('two loaves')] }));

            act(() => instance.onend?.());
            expect(result.current.listening).toBe(true);
            expect(instance.startCount).toBe(2);

            act(() => instance.onresult?.({ resultIndex: 0, results: [phrase('of bread')] }));
            expect(result.current.transcript).toBe('two loaves of bread');
        });

        it('does not restart after an error', () => {
            const { result } = renderHook(() => useSpeechRecognition({ keepListening: true }));
            act(() => result.current.start());

            act(() => instance.onerror?.({ error: 'not-allowed' }));
            act(() => instance.onend?.());

            expect(result.current.listening).toBe(false);
            expect(instance.startCount).toBe(1);
        });

        it('does not restart after an explicit stop', () => {
            const { result } = renderHook(() => useSpeechRecognition({ keepListening: true }));
            act(() => result.current.start());

            act(() => result.current.stop());

            expect(result.current.listening).toBe(false);
            expect(instance.startCount).toBe(1);
        });
    });

    it('aborts recognition on unmount', () => {
        const { result, unmount } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());

        unmount();

        expect(instance.aborted).toBe(true);
    });
});
