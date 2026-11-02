import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSwipeGesture } from './useSwipeGesture';

describe('useSwipeGesture', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with closed swipe state', () => {
        const { result } = renderHook(() => useSwipeGesture());

        expect(result.current.swipeState).toBe('closed');
    });

    it('provides motion values and controls', () => {
        const { result } = renderHook(() => useSwipeGesture());

        expect(result.current.x).toBeDefined();
        expect(result.current.controls).toBeDefined();
    });

    it('provides handleDragEnd callback', () => {
        const { result } = renderHook(() => useSwipeGesture());

        expect(typeof result.current.handleDragEnd).toBe('function');
    });

    it('provides closeSwipe callback', () => {
        const { result } = renderHook(() => useSwipeGesture());

        expect(typeof result.current.closeSwipe).toBe('function');
    });

    it('swipes left when offset exceeds threshold', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -100 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('left');
    });

    it('swipes right when offset exceeds threshold', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: 100 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('right');
    });

    it('considers velocity for swipe detection', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -40 },
                velocity: { x: -600 },
            });
        });

        expect(result.current.swipeState).toBe('left');
    });

    it('closes swipe when offset is small while open', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -100 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('left');

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: 15 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('closed');
    });

    it('closeSwipe explicitly closes any open swipe', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -100 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('left');

        act(() => {
            result.current.closeSwipe();
        });

        expect(result.current.swipeState).toBe('closed');
    });

    it('ignores closeSwipe when already closed', () => {
        const { result } = renderHook(() => useSwipeGesture());

        expect(result.current.swipeState).toBe('closed');

        act(() => {
            result.current.closeSwipe();
        });

        expect(result.current.swipeState).toBe('closed');
    });

    it('springs back to center when swipe is too small', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -30 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('closed');
    });

    it('maintains open state when drag is minimal while open', () => {
        const { result } = renderHook(() => useSwipeGesture());

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -100 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('left');

        act(() => {
            result.current.handleDragEnd(new PointerEvent('dragend'), {
                offset: { x: -5 },
                velocity: { x: 0 },
            });
        });

        expect(result.current.swipeState).toBe('closed');
    });
});
