import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { useGroupByAisle } from './useGroupByAisle';

describe('useGroupByAisle', () => {
    beforeEach(() => localStorage.clear());

    it('defaults to ungrouped', () => {
        expect(renderHook(() => useGroupByAisle()).result.current[0]).toBe(false);
    });

    it('remembers the choice across mounts', () => {
        const first = renderHook(() => useGroupByAisle());
        act(() => first.result.current[1]());

        expect(first.result.current[0]).toBe(true);
        expect(renderHook(() => useGroupByAisle()).result.current[0]).toBe(true);
    });
});
