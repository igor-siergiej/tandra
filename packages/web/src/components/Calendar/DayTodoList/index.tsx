import type { Label, User } from '@tandra/types';
import { Users } from 'lucide-react';

import { HandDrawnStrike } from '../../HandDrawnStrike';
import { Checkbox } from '../../ui/checkbox';
import { SwipeableRow } from '../SwipeableRow';

export interface DayTodoItem {
    todoId: string;
    title: string;
    time?: string;
    done: boolean;
    overdue?: boolean;
    labelColor?: string;
    dimmed?: boolean;
    occurrenceDay: string; // dayKey of the occurrence
    ownerId: string;
    users?: User[];
}

/** Shared by DayTodoList, WeekAgenda and CalendarBody so the per-row handler props aren't
 * repeated (and drift) across all three prop interfaces. */
export interface TodoRowHandlers {
    currentUserId?: string;
    onToggle: (todoId: string, occurrenceDay: string) => void;
    onDelete: (todoId: string) => void;
    onEdit?: (todoId: string) => void;
    onManageSharing?: (item: DayTodoItem) => void;
}

export interface DayTodoListProps extends TodoRowHandlers {
    items: DayTodoItem[];
    labels: Label[];
}

interface ShareButtonProps {
    title: string;
    isShared: boolean;
    onClick: () => void;
}

const ShareButton = ({ title, isShared, onClick }: ShareButtonProps) => (
    <button
        type="button"
        aria-label={`Manage sharing for ${title}`}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className={`shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground ${isShared ? 'text-primary' : ''}`}
    >
        <Users className="h-4 w-4" />
    </button>
);

const rowClassFor = (dimmed?: boolean): string =>
    `flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 transition-opacity ${dimmed ? 'opacity-40' : ''}`;

const titleClassFor = (done: boolean): string => `flex-1 text-left ${done ? 'text-muted-foreground' : ''}`;

const canManageSharing = (item: DayTodoItem, currentUserId: string | undefined, hasHandler: boolean): boolean =>
    hasHandler && item.ownerId === currentUserId;

const TodoTitle = ({ item, onEdit }: { item: DayTodoItem; onEdit?: (todoId: string) => void }) => (
    <>
        <span className={`text-xs w-12 ${item.overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {item.time}
        </span>
        <button
            type="button"
            aria-label={`Edit ${item.title}`}
            className={titleClassFor(item.done)}
            onClick={() => onEdit?.(item.todoId)}
        >
            <HandDrawnStrike struck={item.done}>{item.title}</HandDrawnStrike>
        </button>
        {item.overdue && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                Overdue
            </span>
        )}
    </>
);

interface DayTodoRowProps extends TodoRowHandlers {
    item: DayTodoItem;
}

const DayTodoRow = ({ item, currentUserId, onToggle, onDelete, onEdit, onManageSharing }: DayTodoRowProps) => (
    <li data-todo-title={item.title}>
        <SwipeableRow onDelete={() => onDelete(item.todoId)}>
            <div className={rowClassFor(item.dimmed)}>
                <span className="w-1 self-stretch rounded" style={{ backgroundColor: item.labelColor }} />
                <Checkbox checked={item.done} onCheckedChange={() => onToggle(item.todoId, item.occurrenceDay)} />
                <TodoTitle item={item} onEdit={onEdit} />
                {canManageSharing(item, currentUserId, Boolean(onManageSharing)) && (
                    <ShareButton
                        title={item.title}
                        isShared={Boolean(item.users?.length)}
                        onClick={() => onManageSharing?.(item)}
                    />
                )}
            </div>
        </SwipeableRow>
    </li>
);

export const DayTodoList = ({ items, labels: _labels, ...handlers }: DayTodoListProps) => {
    if (items.length === 0) {
        return <p className="text-sm text-muted-foreground py-4 text-center">No todos for this day</p>;
    }
    return (
        <ul className="space-y-2 py-2">
            {items.map((item) => (
                <DayTodoRow key={`${item.todoId}-${item.occurrenceDay}`} item={item} {...handlers} />
            ))}
        </ul>
    );
};
