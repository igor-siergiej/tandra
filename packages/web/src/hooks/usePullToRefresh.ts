import { animate, useMotionValue } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const RESISTANCE = 0.4;
const THRESHOLD = 80;
const MAX_PULL = 120;

// Minimum downward travel before committing to pull mode and calling preventDefault.
// Must be large enough that: (a) ordinary scroll-down gestures that start with a
// tiny downward jitter don't accidentally lock into pull mode, and (b) the user's
// finger is clearly past the halfway point of a deliberate pull before we take over.
const PULL_COMMIT_THRESHOLD = 60;

const SPRING_BACK = { type: 'spring', stiffness: 300, damping: 30 } as const;
const SPRING_HOLD = { type: 'spring', stiffness: 200, damping: 25 } as const;

export interface UsePullToRefreshReturn {
    scrollRef: React.RefObject<HTMLDivElement | null>;
    pullY: ReturnType<typeof useMotionValue<number>>;
    isRefreshing: boolean;
    hasTriggered: boolean;
}

export function usePullToRefresh(onRefresh: () => Promise<void>): UsePullToRefreshReturn {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);

    const pullY = useMotionValue(0);

    const isPulling = useRef(false);
    const isCommitted = useRef(false); // true once we've called preventDefault and taken over the gesture
    const touchStartY = useRef(0);
    const hasFiredHaptic = useRef(false);
    const isRefreshingRef = useRef(false);
    const currentAnim = useRef<ReturnType<typeof animate> | null>(null);

    const springTo = useCallback(
        (target: number, config: typeof SPRING_BACK | typeof SPRING_HOLD) => {
            currentAnim.current?.stop();
            currentAnim.current = animate(pullY, target, config);
        },
        [pullY]
    );

    useEffect(() => {
        const el = scrollRef.current;

        if (!el) return;

        // Abort any uncommitted pull the moment the container actually scrolls.
        // This catches the case where the user touches at scrollTop=0 then swipes
        // up (to scroll down into content) — the browser fires a scroll event and
        // we immediately give up the gesture before calling preventDefault.
        const onScroll = () => {
            if (isPulling.current && !isCommitted.current) {
                isPulling.current = false;
                pullY.set(0);
            }
        };

        const onTouchStart = (e: TouchEvent) => {
            if (isRefreshingRef.current) return;

            // Use a tolerance of 1px to absorb sub-pixel rounding at the true top.
            if (el.scrollTop > 1) return;
            touchStartY.current = e.touches[0].clientY;
            isPulling.current = true;
            isCommitted.current = false;
            hasFiredHaptic.current = false;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!isPulling.current) return;

            // User scrolled away from top — abort pull mode
            if (el.scrollTop > 1) {
                isPulling.current = false;
                isCommitted.current = false;

                return;
            }

            const rawDelta = e.touches[0].clientY - touchStartY.current;

            // Upward motion — let the browser scroll, stop tracking
            if (rawDelta <= 0) {
                isPulling.current = false;
                isCommitted.current = false;
                pullY.set(0);

                return;
            }

            // Wait for enough downward movement before committing.
            // During this window we don't call preventDefault, so if the user's
            // intent turns out to be scrolling (rawDelta goes negative), the browser
            // handles it naturally without us having blocked it first.
            if (rawDelta < PULL_COMMIT_THRESHOLD) return;

            // Clear downward intent confirmed — take over the gesture
            isCommitted.current = true;
            e.preventDefault();

            const resisted = Math.min(rawDelta * RESISTANCE, MAX_PULL);
            pullY.set(resisted);

            if (resisted >= THRESHOLD && !hasFiredHaptic.current) {
                hasFiredHaptic.current = true;
                navigator.vibrate?.(10);
                setHasTriggered(true);
            } else if (resisted < THRESHOLD && hasFiredHaptic.current) {
                hasFiredHaptic.current = false;
                setHasTriggered(false);
            }
        };

        const onTouchEnd = async () => {
            if (!isPulling.current) return;
            isPulling.current = false;

            // If we never committed (user didn't clearly pull down), do nothing
            if (!isCommitted.current) {
                isCommitted.current = false;

                return;
            }

            isCommitted.current = false;

            const current = pullY.get();

            if (current >= THRESHOLD) {
                springTo(THRESHOLD, SPRING_HOLD);
                isRefreshingRef.current = true;
                setIsRefreshing(true);

                try {
                    await onRefresh();
                } finally {
                    isRefreshingRef.current = false;
                    setIsRefreshing(false);
                    setHasTriggered(false);
                    springTo(0, SPRING_BACK);
                }
            } else {
                setHasTriggered(false);
                springTo(0, SPRING_BACK);
            }
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('scroll', onScroll);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            currentAnim.current?.stop();
        };
    }, [onRefresh, pullY, springTo]);

    return { scrollRef, pullY, isRefreshing, hasTriggered };
}
