import type { Todo } from '@tandra/types';
import { describe, expect, it } from 'vite-plus/test';

import { buildUpdateBody } from './buildUpdateBody';

const todo: Todo = {
    id: 't1',
    ownerId: 'u1',
    title: 'Pay rent',
    done: false,
    dateAdded: new Date(),
    dueDate: '2026-06-25',
    time: '09:00',
    labelId: 'L1',
    recurrence: { freq: 'monthly', interval: 1 },
};

describe('buildUpdateBody', () => {
    it('sends changed values and clears nothing when all fields are kept', () => {
        const body = buildUpdateBody(todo, {
            title: 'Pay rent!',
            dueDate: new Date(2026, 5, 26),
            time: '10:00',
            labelId: 'L1',
            recurrence: todo.recurrence,
        });

        expect(body).toEqual({
            title: 'Pay rent!',
            dueDate: '2026-06-26',
            time: '10:00',
            labelId: 'L1',
            recurrence: todo.recurrence,
        });
    });

    it('lists every removed optional field in clear', () => {
        const body = buildUpdateBody(todo, { title: 'Pay rent' });

        expect(body).toEqual({ title: 'Pay rent', clear: ['dueDate', 'time', 'labelId', 'recurrence'] });
    });

    it('does not clear fields the todo never had', () => {
        const body = buildUpdateBody(
            { ...todo, time: undefined },
            { title: 'Pay rent', dueDate: new Date(2026, 5, 25) }
        );

        expect(body.clear).toEqual(['labelId', 'recurrence']);
    });
});
