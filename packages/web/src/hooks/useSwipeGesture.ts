import { type AnimationControls, type MotionValue, useAnimation, useMotionValue } from 'motion/react';
import { useState } from 'react';

export interface PanInfo {
    offset: { x: number };
    velocity: { x: number };
}

export type SwipeState = 'closed' | 'left' | 'right';

/** The pointer event framer-motion hands to a drag-end callback. */
export type DragEndEvent = MouseEvent | TouchEvent | PointerEvent;

interface SwipeTarget {
    newState: SwipeState;
    targetX: number;
}

export interface UseSwipeGestureReturn {
    x: MotionValue<number>;
    controls: AnimationControls;
    swipeState: SwipeState;
    handleDragEnd: (event: DragEndEvent, info: PanInfo) => void;
    closeSwipe: () => void;
}

// Matches Calendar/SwipeableRow's snap-back spring — stiffer/faster settle than the
// old 300/30 shrinks the window where a card is still mid-animation over a revealed
// button when the next tap lands, so a tap that arrives before settle still hits the
// button instead of the still-overlapping card.
const SPRING = { type: 'spring', stiffness: 400, damping: 40 } as const;

// Must match the revealed action button's width (w-20 = 80px) so the swiped-open
// card fully clears the button. A shorter reveal leaves part of the button behind
// the still-overlapping card, so a tap there hits the card (closing the swipe)
// instead of the button underneath — requiring a second tap to actually press it.
export const SWIPE_REVEAL_DISTANCE = 80;

const resolveSwipeTarget = (swipeState: SwipeState, offset: number, velocity: number): SwipeTarget => {
    const threshold = 60;
    const swipeVelocityThreshold = 500;
    const closeThreshold = 30;

    const shouldSwipeLeft = offset < -threshold || velocity < -swipeVelocityThreshold;
    const shouldSwipeRight = offset > threshold || velocity > swipeVelocityThreshold;

    if (swipeState === 'left' && offset > closeThreshold) {
        return { newState: 'closed', targetX: 0 };
    }

    if (swipeState === 'right' && offset < -closeThreshold) {
        return { newState: 'closed', targetX: 0 };
    }

    if (shouldSwipeLeft && swipeState !== 'left') {
        return { newState: 'left', targetX: -SWIPE_REVEAL_DISTANCE };
    }

    if (shouldSwipeRight && swipeState !== 'right') {
        return { newState: 'right', targetX: SWIPE_REVEAL_DISTANCE };
    }

    if (swipeState !== 'closed' && Math.abs(offset) < 20) {
        return { newState: 'closed', targetX: 0 };
    }

    if (swipeState === 'closed') {
        return { newState: 'closed', targetX: 0 };
    }

    return { newState: swipeState, targetX: swipeState === 'left' ? -SWIPE_REVEAL_DISTANCE : SWIPE_REVEAL_DISTANCE };
};

export function useSwipeGesture(): UseSwipeGestureReturn {
    const x = useMotionValue(0);
    const controls = useAnimation();
    const [swipeState, setSwipeState] = useState<SwipeState>('closed');

    const handleDragEnd = (_event: DragEndEvent, info: PanInfo) => {
        const { newState, targetX } = resolveSwipeTarget(swipeState, info.offset.x, info.velocity.x);
        setSwipeState(newState);
        void controls.start({ x: targetX, transition: SPRING });
    };

    const closeSwipe = () => {
        if (swipeState !== 'closed') {
            setSwipeState('closed');
            void controls.start({ x: 0, transition: SPRING });
        }
    };

    return {
        x,
        controls,
        swipeState,
        handleDragEnd,
        closeSwipe,
    };
}
