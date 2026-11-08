import type { Todo } from '@tandra/types';

import { InboxDrawerItem } from './InboxDrawerItem';

export interface InboxDrawerListProps {
    todos: Todo[];
    schedulingTodoId: string | null;
    onDelete: (todoId: string) => void;
    onSelectForScheduling: (todoId: string) => void;
}

export const InboxDrawerList = ({ todos, schedulingTodoId, onDelete, onSelectForScheduling }: InboxDrawerListProps) => (
    <ul className="max-h-48 overflow-y-auto px-4 pb-3 space-y-1.5">
        {todos.length === 0 && <li className="text-sm text-muted-foreground py-2">Nothing unscheduled</li>}
        {todos.map((todo) => (
            <InboxDrawerItem
                key={todo.id}
                todo={todo}
                scheduling={schedulingTodoId === todo.id}
                onDelete={() => onDelete(todo.id)}
                onToggleScheduling={() => onSelectForScheduling(todo.id)}
            />
        ))}
    </ul>
);
