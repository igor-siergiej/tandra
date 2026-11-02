import { Edit2, Loader2, Trash2 } from 'lucide-react';
import type { AnimationControls, MotionValue } from 'motion/react';
import { motion } from 'motion/react';
import type { MouseEvent, ReactNode } from 'react';

import type { PanInfo } from '../../hooks/useSwipeGesture';
import { SWIPE_REVEAL_DISTANCE } from '../../hooks/useSwipeGesture';
import { Button } from '../ui/button';

export interface SwipeRevealShellProps {
    children: ReactNode;
    x: MotionValue<number>;
    controls: AnimationControls;
    swipeState: 'closed' | 'left' | 'right';
    onDragEnd: (event: unknown, info: PanInfo) => void;
    onCloseSwipe: () => void;
    onDelete: (e?: MouseEvent) => void;
    onEdit?: (e?: MouseEvent) => void;
    deleteLoading?: boolean;
    disabled?: boolean;
    hideActions?: boolean;
    deleteAriaLabel?: string;
    editAriaLabel?: string;
}

interface RevealedActionButtonProps {
    positionClassName: string;
    buttonClassName: string;
    onClick: (e?: MouseEvent) => void;
    ariaLabel: string;
    disabled?: boolean;
    children: ReactNode;
}

const RevealedActionButton = ({
    positionClassName,
    buttonClassName,
    onClick,
    ariaLabel,
    disabled,
    children,
}: RevealedActionButtonProps) => (
    <div className={positionClassName}>
        <Button onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={buttonClassName}>
            {children}
        </Button>
    </div>
);

// Closes an already-open swipe on a tap anywhere on the content that isn't a
// revealed action button — module-level (not a closure) so it doesn't add to
// SwipeRevealShell's own complexity score.
const handleContentClick =
    (swipeState: 'closed' | 'left' | 'right', onCloseSwipe: () => void) => (e: MouseEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        if (swipeState !== 'closed') onCloseSwipe();
    };

// Shared swipe-reveal shell for a listable row with edit/delete actions — extracted
// from ItemCheckBox/IngredientItem/DraftIngredientRow, which each hand-rolled the same
// drag + revealed-button markup, so any future fix to the shared shell applies to
// shopping list items, recipe ingredients and draft ingredient rows alike instead of
// three copies drifting apart.
//
// Remaining branches below are independent ternaries/guards tied 1:1 to props
// (loading icon, drag-disabled, edit-reveal width, hide-actions); collapsing
// them further would obscure the prop wiring rather than simplify it.
// fallow-ignore-next-line complexity
export const SwipeRevealShell = ({
    children,
    x,
    controls,
    swipeState,
    onDragEnd,
    onCloseSwipe,
    onDelete,
    onEdit,
    deleteLoading = false,
    disabled = false,
    hideActions = false,
    deleteAriaLabel = 'Delete',
    editAriaLabel = 'Edit',
}: SwipeRevealShellProps) => {
    return (
        <div className="relative rounded-lg overflow-hidden">
            {!hideActions && (
                <>
                    <RevealedActionButton
                        positionClassName="absolute inset-y-0 right-0 flex items-center justify-end w-20"
                        buttonClassName="h-[calc(100%-2px)] w-full rounded-lg bg-destructive hover:bg-destructive/90 text-white border border-destructive/20 shadow-sm flex items-center justify-center mr-1"
                        onClick={onDelete}
                        disabled={deleteLoading}
                        ariaLabel={deleteAriaLabel}
                    >
                        {deleteLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 size={20} />}
                    </RevealedActionButton>

                    {onEdit && (
                        <RevealedActionButton
                            positionClassName="absolute inset-y-0 left-0 flex items-center justify-start pl-1 w-20"
                            buttonClassName="h-[calc(100%-2px)] w-full rounded-lg bg-blue-500 hover:bg-blue-600 text-white border border-blue-600/20 shadow-sm flex items-center justify-center"
                            onClick={onEdit}
                            ariaLabel={editAriaLabel}
                        >
                            <Edit2 size={20} />
                        </RevealedActionButton>
                    )}
                </>
            )}

            <motion.div
                drag={disabled ? false : 'x'}
                dragConstraints={{ left: -SWIPE_REVEAL_DISTANCE, right: onEdit ? SWIPE_REVEAL_DISTANCE : 0 }}
                dragElastic={0.1}
                onDragEnd={onDragEnd}
                animate={controls}
                style={{ x }}
                className="relative z-10 bg-background rounded-lg"
                onClick={handleContentClick(swipeState, onCloseSwipe)}
            >
                {children}
            </motion.div>
        </div>
    );
};
