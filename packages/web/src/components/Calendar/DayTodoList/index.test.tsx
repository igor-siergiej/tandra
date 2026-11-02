import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type DayTodoItem, DayTodoList } from './index';

const item = (over: Partial<DayTodoItem> = {}): DayTodoItem => ({
    todoId: 't1',
    title: 'Pay rent',
    done: false,
    occurrenceDay: '2026-06-25',
    ownerId: 'owner-1',
    ...over,
});

describe('DayTodoList', () => {
    it('shows a manage-sharing button for the owner', () => {
        render(
            <DayTodoList
                items={[item()]}
                labels={[]}
                currentUserId="owner-1"
                onToggle={vi.fn()}
                onDelete={vi.fn()}
                onManageSharing={vi.fn()}
            />
        );

        expect(screen.getByLabelText('Manage sharing for Pay rent')).toBeInTheDocument();
    });

    it('hides the manage-sharing button for a non-owner (shared member)', () => {
        render(
            <DayTodoList
                items={[item()]}
                labels={[]}
                currentUserId="member-1"
                onToggle={vi.fn()}
                onDelete={vi.fn()}
                onManageSharing={vi.fn()}
            />
        );

        expect(screen.queryByLabelText('Manage sharing for Pay rent')).not.toBeInTheDocument();
    });

    it('hides the manage-sharing button when no handler is provided', () => {
        render(
            <DayTodoList items={[item()]} labels={[]} currentUserId="owner-1" onToggle={vi.fn()} onDelete={vi.fn()} />
        );

        expect(screen.queryByLabelText('Manage sharing for Pay rent')).not.toBeInTheDocument();
    });

    it('calls onManageSharing with the item when clicked, without toggling the todo', async () => {
        const user = userEvent.setup();
        const onManageSharing = vi.fn();
        const onToggle = vi.fn();
        render(
            <DayTodoList
                items={[item()]}
                labels={[]}
                currentUserId="owner-1"
                onToggle={onToggle}
                onDelete={vi.fn()}
                onManageSharing={onManageSharing}
            />
        );

        await user.click(screen.getByLabelText('Manage sharing for Pay rent'));

        expect(onManageSharing).toHaveBeenCalledWith(item());
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('marks overdue todos', () => {
        render(<DayTodoList items={[item({ overdue: true })]} labels={[]} onToggle={vi.fn()} onDelete={vi.fn()} />);

        expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('calls onEdit with the todo id when the title is tapped', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn();
        render(<DayTodoList items={[item()]} labels={[]} onToggle={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);

        await user.click(screen.getByRole('button', { name: 'Edit Pay rent' }));

        expect(onEdit).toHaveBeenCalledWith('t1');
    });
});
