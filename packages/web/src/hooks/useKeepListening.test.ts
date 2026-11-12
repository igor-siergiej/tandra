import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { useKeepListening } from './useKeepListening';

describe('useKeepListening', () => {
    beforeEach(() => localStorage.clear());

    it('defaults to off', () => {
        expect(renderHook(() => useKeepListening()).result.current[0]).toBe(false);
    });

    it('remembers the choice across mounts', () => {
        const first = renderHook(() => useKeepListening());
        act(() => first.result.current[1](true));

        expect(first.result.current[0]).toBe(true);
        expect(renderHook(() => useKeepListening()).result.current[0]).toBe(true);
    });
});
