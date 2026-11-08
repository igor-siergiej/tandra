import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { UnitSystemProvider, useUnitSystem } from './UnitSystemContext';

const wrapper = ({ children }: { children: ReactNode }) => <UnitSystemProvider>{children}</UnitSystemProvider>;

describe('UnitSystemContext', () => {
    beforeEach(() => localStorage.clear());

    it('defaults to "original"', () => {
        const { result } = renderHook(() => useUnitSystem(), { wrapper });
        expect(result.current.unitSystem).toBe('original');
    });

    it('persists a chosen system and reads it back on remount', () => {
        const first = renderHook(() => useUnitSystem(), { wrapper });
        act(() => first.result.current.setUnitSystem('metric'));

        expect(first.result.current.unitSystem).toBe('metric');
        expect(localStorage.getItem('unitSystem')).toBe('metric');
        first.unmount();

        const second = renderHook(() => useUnitSystem(), { wrapper });
        expect(second.result.current.unitSystem).toBe('metric');
    });

    it('ignores an invalid stored value', () => {
        localStorage.setItem('unitSystem', 'bogus');
        const { result } = renderHook(() => useUnitSystem(), { wrapper });
        expect(result.current.unitSystem).toBe('original');
    });
});
