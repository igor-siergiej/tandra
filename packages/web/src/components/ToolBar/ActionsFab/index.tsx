import { Ellipsis } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ComponentType } from 'react';
import { useState } from 'react';

import { ToolBarButton } from '../ToolBarButton';

export interface ActionItem {
    show: boolean;
    label: string;
    icon: ComponentType<{ className?: string }>;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'destructive';
}

interface ActionsFabProps {
    actionItems: ActionItem[];
}

const rowClasses = (variant: ActionItem['variant'], disabled: boolean | undefined) => {
    if (disabled) return 'text-muted-foreground opacity-50 cursor-not-allowed';
    if (variant === 'destructive') return 'text-destructive hover:bg-destructive/10';
    return 'text-popover-foreground hover:bg-accent hover:text-accent-foreground';
};

export const ActionsFab = ({ actionItems }: ActionsFabProps) => {
    const [open, setOpen] = useState(false);
    const visibleItems = actionItems.filter((item) => item.show);
    const hasActions = visibleItems.length > 0;

    const handleItemClick = (item: ActionItem) => {
        if (item.disabled) return;
        item.onClick();
        setOpen(false);
    };

    return (
        <div className="relative">
            <AnimatePresence>
                {open && hasActions && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.25 }}
                        className="absolute bottom-full left-1/2 mb-3 min-w-44 -translate-x-1/2 rounded-2xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur-md"
                    >
                        <div className="flex flex-col gap-0.5">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => handleItemClick(item)}
                                        disabled={item.disabled}
                                        title={item.label}
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${rowClasses(item.variant, item.disabled)}`}
                                    >
                                        <Icon className="size-4 shrink-0" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ToolBarButton
                icon={Ellipsis}
                title="Actions"
                onClick={() => hasActions && setOpen((o) => !o)}
                active={open}
                disabled={!hasActions}
            />
        </div>
    );
};
