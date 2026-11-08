import { Trash2 } from 'lucide-react';
import { animate, motion, type PanInfo, useMotionValue } from 'motion/react';
import type { ReactNode } from 'react';

const DELETE_THRESHOLD = -80;

export interface SwipeableRowProps {
    children: ReactNode;
    onDelete: () => void;
}

export const SwipeableRow = ({ children, onDelete }: SwipeableRowProps) => {
    const x = useMotionValue(0);

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
        if (info.offset.x < DELETE_THRESHOLD) {
            onDelete();
        } else {
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 });
        }
    };

    return (
        <div className="relative overflow-hidden rounded-lg">
            <div className="absolute inset-y-0 right-0 flex items-center rounded-lg bg-destructive px-4 text-destructive-foreground">
                <Trash2 className="h-4 w-4" />
            </div>
            <motion.div
                drag="x"
                dragConstraints={{ left: -120, right: 0 }}
                dragElastic={0.08}
                style={{ x }}
                onDragEnd={handleDragEnd}
                className="relative bg-background"
            >
                {children}
            </motion.div>
        </div>
    );
};
