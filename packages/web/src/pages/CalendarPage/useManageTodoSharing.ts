import type { User } from '@tandra/types';
import { useState } from 'react';

import type { DayTodoItem } from '../../components/Calendar/DayTodoList';

export const useManageTodoSharing = (updateTodo: (todoId: string, body: { users: User[] }) => void) => {
    const [sharingItem, setSharingItem] = useState<DayTodoItem | null>(null);

    const closeSharing = () => setSharingItem(null);

    const saveSharing = (users: User[]) => {
        if (!sharingItem) return;
        void updateTodo(sharingItem.todoId, { users });
        setSharingItem((prev) => (prev ? { ...prev, users } : prev));
    };

    return { sharingItem, openSharing: setSharingItem, closeSharing, saveSharing };
};
