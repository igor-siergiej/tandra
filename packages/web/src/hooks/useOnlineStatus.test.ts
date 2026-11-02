import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOnlineStatus } from './useOnlineStatus';

afterEach(() => vi.restoreAllMocks());

describe('useOnlineStatus', () => {
    it('reflects navigator.onLine and updates on events', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        expect(result.current).toBe(false);
        act(() => {
            window.dispatchEvent(new Event('online'));
        });
        expect(result.current).toBe(true);
    });
});
