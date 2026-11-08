import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fake, present } from '../testing/fake';
import type { SpeechRecognitionLike } from '../utils/speechRecognition';
import { useSpeechRecognition } from './useSpeechRecognition';

/** Every recognition the hook has constructed; a test drives the latest. */
const created: FakeRecognition[] = [];

const latest = () => present(created.at(-1), 'speech recognition');

class FakeRecognition implements SpeechRecognitionLike {
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
        created.push(this);
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
        fake<{ webkitSpeechRecognition: unknown }>(window).webkitSpeechRecognition = FakeRecognition;
    });

    afterEach(() => {
        delete fake<{ webkitSpeechRecognition?: unknown }>(window).webkitSpeechRecognition;
    });

    it('reports unsupported when the browser has no speech recognition', () => {
        delete fake<{ webkitSpeechRecognition?: unknown }>(window).webkitSpeechRecognition;

        expect(renderHook(() => useSpeechRecognition()).result.current.supported).toBe(false);
    });

    it('listens, exposes the live transcript and stops', () => {
        const { result } = renderHook(() => useSpeechRecognition({ lang: 'en-GB' }));

        act(() => result.current.start());
        expect(latest().started).toBe(true);
        expect(latest().lang).toBe('en-GB');
        expect(result.current.listening).toBe(true);

        act(() => latest().onresult?.({ resultIndex: 0, results: [phrase('two loaves'), phrase('of bread')] }));
        expect(result.current.transcript).toBe('two loaves of bread');

        act(() => result.current.stop());
        expect(result.current.listening).toBe(false);
    });

    it('turns a blocked microphone into a readable message', () => {
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        act(() => latest().onerror?.({ error: 'not-allowed' }));

        expect(result.current.error).toMatch(/Microphone access was blocked/);
        expect(result.current.listening).toBe(false);
    });

    it('ends at the first pause by default', () => {
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        expect(latest().continuous).toBe(false);

        act(() => latest().onend?.());
        expect(result.current.listening).toBe(false);
        expect(latest().startCount).toBe(1);
    });

    describe('keepListening', () => {
        it('restarts when the browser ends the session and keeps the earlier text', () => {
            const { result } = renderHook(() => useSpeechRecognition({ keepListening: true }));

            act(() => result.current.start());
            expect(latest().continuous).toBe(true);
            act(() => latest().onresult?.({ resultIndex: 0, results: [phrase('two loaves')] }));

            act(() => latest().onend?.());
            expect(result.current.listening).toBe(true);
            expect(latest().startCount).toBe(2);

            act(() => latest().onresult?.({ resultIndex: 0, results: [phrase('of bread')] }));
            expect(result.current.transcript).toBe('two loaves of bread');
        });

        it('does not restart after an error', () => {
            const { result } = renderHook(() => useSpeechRecognition({ keepListening: true }));
            act(() => result.current.start());

            act(() => latest().onerror?.({ error: 'not-allowed' }));
            act(() => latest().onend?.());

            expect(result.current.listening).toBe(false);
            expect(latest().startCount).toBe(1);
        });

        it('does not restart after an explicit stop', () => {
            const { result } = renderHook(() => useSpeechRecognition({ keepListening: true }));
            act(() => result.current.start());

            act(() => result.current.stop());

            expect(result.current.listening).toBe(false);
            expect(latest().startCount).toBe(1);
        });
    });

    it('aborts recognition on unmount', () => {
        const { result, unmount } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());

        unmount();

        expect(latest().aborted).toBe(true);
    });
});
