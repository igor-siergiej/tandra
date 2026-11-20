import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useAnalyticsConsent } from './useAnalyticsConsent';

const analytics = vi.hoisted(() => ({ startReplay: vi.fn(), stopReplay: vi.fn() }));

vi.mock('../utils/analytics', () => analytics);

describe('useAnalyticsConsent: usage statistics and a running recording', () => {
    beforeEach(() => {
        localStorage.clear();
        analytics.startReplay.mockClear();
        analytics.stopReplay.mockClear();
    });

    it('opting out of usage statistics stops a recording that is already running', () => {
        localStorage.setItem('tandra.replayConsent', 'true');
        const { result } = renderHook(() => useAnalyticsConsent());

        act(() => result.current.setUsageEnabled(false));

        expect(analytics.stopReplay).toHaveBeenCalledTimes(1);
        expect(analytics.startReplay).not.toHaveBeenCalled();
    });

    it('opting back in resumes recording for a visitor who consented while usage was off', () => {
        localStorage.setItem('umami.disabled', 'true');
        const { result } = renderHook(() => useAnalyticsConsent());
        act(() => result.current.setRecordingsEnabled(true));
        analytics.startReplay.mockClear();

        act(() => result.current.setUsageEnabled(true));

        expect(analytics.startReplay).toHaveBeenCalledTimes(1);
    });

    it('opting back in does not start recording without consent', () => {
        localStorage.setItem('umami.disabled', 'true');
        const { result } = renderHook(() => useAnalyticsConsent());

        act(() => result.current.setUsageEnabled(true));

        expect(analytics.startReplay).not.toHaveBeenCalled();
    });
});
