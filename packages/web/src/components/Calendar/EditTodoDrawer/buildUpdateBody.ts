import { isoDay, type Recurrence, type Todo } from '@tandra/types';

import type { UpdateTodoBody } from '../../../api';

export interface EditValues {
    title: string;
    dueDate?: Date;
    time?: string;
    labelId?: string;
    recurrence?: Recurrence;
}

const CLEARABLE = ['dueDate', 'time', 'labelId', 'recurrence'] as const;

export const buildUpdateBody = (todo: Todo, { dueDate, ...rest }: EditValues): UpdateTodoBody => {
    const values = { ...rest, dueDate: dueDate ? isoDay(dueDate) : undefined };
    const clear = CLEARABLE.filter((field) => !values[field] && todo[field]);
    const defined = Object.fromEntries(Object.entries(values).filter(([, value]) => value));

    return clear.length > 0 ? { ...defined, clear } : defined;
};
