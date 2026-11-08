import type { Todo } from '@tandra/types';
import { GripVertical } from 'lucide-react';

import { SwipeableRow } from '../SwipeableRow';

export interface InboxDrawerItemProps {
    todo: Todo;
    scheduling: boolean;
    onDelete: () => void;
    onToggleScheduling: () => void;
}

export const InboxDrawerItem = ({ todo, scheduling, onDelete, onToggleScheduling }: InboxDrawerItemProps) => (
    <li data-todo-title={todo.title} className="flex items-center gap-2">
        <button
            type="button"
            data-testid={`inbox-item-${todo.id}`}
            draggable
            aria-label="Drag to schedule"
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', todo.id);
                e.dataTransfer.effectAllowed = 'move';
            }}
            className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
        >
            <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
            <SwipeableRow onDelete={onDelete}>
                <button
                    type="button"
                    data-testid={`inbox-item-schedule-${todo.id}`}
                    aria-pressed={scheduling}
                    onClick={onToggleScheduling}
                    className={`w-full truncate rounded-lg px-3 py-1.5 text-left text-sm ${
                        scheduling ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/40'
                    }`}
                >
                    {todo.title}
                </button>
            </SwipeableRow>
        </div>
    </li>
);
