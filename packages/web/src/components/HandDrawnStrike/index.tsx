import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';

// Same stroke as the landing site's check-off animation.
const STRIKE_PATH = 'M1 12 C 22 8, 48 14, 70 10 S 92 9, 99 11';
const DRAW_TRANSITION = { duration: 0.45, ease: [0.6, 0, 0.3, 1] } as const;
const INSTANT = { duration: 0 } as const;

const STATIC_STRIKE_PROPS = {
    'data-testid': 'strike-static',
    className: 'line-through decoration-primary decoration-2',
};

const useIsMultiLine = (textRef: RefObject<HTMLSpanElement | null>) => {
    const [isMultiLine, setIsMultiLine] = useState(false);

    useLayoutEffect(() => {
        const el = textRef.current;

        if (!el) return;
        // An inline span yields one client rect per rendered line.
        const measure = () => setIsMultiLine(el.getClientRects().length > 1);
        measure();

        if (typeof ResizeObserver === 'undefined' || !el.parentElement) return;
        const observer = new ResizeObserver(measure);
        observer.observe(el.parentElement);

        return () => observer.disconnect();
    }, [textRef]);

    return isMultiLine;
};

const StrikeStroke = ({ struck }: { struck: boolean }) => {
    const reduceMotion = useReducedMotion();
    const animate = struck ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 };
    const shouldDraw = struck && !reduceMotion;

    return (
        <svg
            aria-hidden="true"
            data-testid="strike-drawn"
            data-struck={struck}
            className="pointer-events-none absolute left-0 top-1/2 h-[0.75em] w-full -translate-y-1/2 overflow-visible"
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
        >
            <motion.path
                d={STRIKE_PATH}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={5}
                strokeLinecap="round"
                initial={false}
                animate={animate}
                transition={shouldDraw ? DRAW_TRANSITION : INSTANT}
            />
        </svg>
    );
};

interface HandDrawnStrikeProps {
    struck: boolean;
    children: ReactNode;
}

export const HandDrawnStrike = ({ struck, children }: HandDrawnStrikeProps) => {
    const textRef = useRef<HTMLSpanElement>(null);
    const isMultiLine = useIsMultiLine(textRef);
    // A single curved stroke can't follow wrapped lines, so long labels fall back to a static strike.
    const staticStrike = struck && isMultiLine;

    return (
        <span className="relative inline-block">
            <span ref={textRef} {...(staticStrike ? STATIC_STRIKE_PROPS : {})}>
                {children}
            </span>
            {!isMultiLine && <StrikeStroke struck={struck} />}
        </span>
    );
};
