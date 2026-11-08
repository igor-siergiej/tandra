import type { Todo } from '@tandra/types';
import { useState } from 'react';

import { InboxDrawerList } from './InboxDrawerList';
import { InboxDrawerToggle } from './InboxDrawerToggle';

export interface InboxDrawerProps {
    todos: Todo[]; // undated todos
    onDelete: (todoId: string) => void;
    schedulingTodoId: string | null;
    onToggleScheduling: (todoId: string) => void;
}

export const InboxDrawer = ({ todos, onDelete, schedulingTodoId, onToggleScheduling }: InboxDrawerProps) => {
    const [open, setOpen] = useState(false);

    const selectForScheduling = (todoId: string) => {
        onToggleScheduling(todoId);
        setOpen(false);
    };

    return (
        <div className="fixed bottom-24 left-0 right-0 z-30 px-4">
            <div className="mx-auto max-w-[500px] rounded-t-xl border bg-background shadow-lg">
                <InboxDrawerToggle count={todos.length} open={open} onClick={() => setOpen((v) => !v)} />
                {schedulingTodoId && (
                    <div className="flex items-center justify-between px-4 pb-2 text-xs text-primary">
                        <span>Tap a day to schedule it</span>
                        <button
                            type="button"
                            onClick={() => onToggleScheduling(schedulingTodoId)}
                            className="font-medium underline"
                        >
                            Cancel
                        </button>
                    </div>
                )}
                {open && (
                    <InboxDrawerList
                        todos={todos}
                        schedulingTodoId={schedulingTodoId}
                        onDelete={onDelete}
                        onSelectForScheduling={selectForScheduling}
                    />
                )}
            </div>
        </div>
    );
};
