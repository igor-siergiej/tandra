import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useVoiceAck } from './useVoiceAck';

describe('useVoiceAck', () => {
    beforeEach(() => localStorage.clear());

    it('starts unacknowledged', () => {
        expect(renderHook(() => useVoiceAck()).result.current[0]).toBe(false);
    });

    it('remembers the acknowledgement across mounts', () => {
        const first = renderHook(() => useVoiceAck());
        act(() => first.result.current[1]());

        expect(first.result.current[0]).toBe(true);
        expect(localStorage.getItem('tandra.voiceAck')).toBe('true');
        expect(renderHook(() => useVoiceAck()).result.current[0]).toBe(true);
    });

    it('asks again once storage is cleared', () => {
        const first = renderHook(() => useVoiceAck());
        act(() => first.result.current[1]());
        localStorage.clear();

        expect(renderHook(() => useVoiceAck()).result.current[0]).toBe(false);
    });
});
