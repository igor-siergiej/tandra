import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MonthGrid } from './index';

describe('MonthGrid', () => {
    const month = new Date('2026-06-15');

    it('renders all days of the month', () => {
        render(
            <MonthGrid
                month={month}
                dotsByDay={{}}
                selectedDay={new Date('2026-06-04')}
                onSelectDay={vi.fn()}
                onDropTodoOnDay={vi.fn()}
            />
        );
        expect(screen.getByText('30')).toBeInTheDocument(); // June has 30 days
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    });

    it('calls onSelectDay when a day is clicked', () => {
        const onSelectDay = vi.fn();
        render(
            <MonthGrid
                month={month}
                dotsByDay={{}}
                selectedDay={undefined}
                onSelectDay={onSelectDay}
                onDropTodoOnDay={vi.fn()}
            />
        );
        fireEvent.click(screen.getAllByText('4')[0]);
        expect(onSelectDay).toHaveBeenCalled();
        const arg = onSelectDay.mock.calls[0][0] as Date;
        expect(arg.getDate()).toBe(4);
    });

    it('fires onDropTodoOnDay with the todo id on drop', () => {
        const onDrop = vi.fn();
        render(
            <MonthGrid
                month={month}
                dotsByDay={{}}
                selectedDay={undefined}
                onSelectDay={vi.fn()}
                onDropTodoOnDay={onDrop}
            />
        );
        const cell = screen.getAllByText('4')[0];
        const dataTransfer = { getData: () => 'todo-123' };
        fireEvent.drop(cell, { dataTransfer });
        expect(onDrop).toHaveBeenCalledWith('todo-123', expect.any(Date));
    });
});
