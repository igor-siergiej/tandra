import { isoDay } from '@tandra/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFriends } from '../../../hooks/useFriends';
import { AddTodoDrawer } from './index';

vi.mock('../../../hooks/useFriends', () => ({
    useFriends: vi.fn(() => ({ friends: [], isLoading: false })),
}));

describe('AddTodoDrawer', () => {
    const noop = () => {};

    it('shows the title field when open', () => {
        render(<AddTodoDrawer open onOpenChange={noop} onAdd={vi.fn()} labels={[]} />);
        expect(screen.getByRole('heading', { name: 'Add Todo' })).toBeInTheDocument();
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    it('requires a title', async () => {
        const onAdd = vi.fn();
        render(<AddTodoDrawer open onOpenChange={noop} onAdd={onAdd} labels={[]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Add Todo' }));
        await waitFor(() => expect(screen.getByText('Title is required')).toBeInTheDocument());
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('submits the title and prefilled date', async () => {
        const onAdd = vi.fn().mockResolvedValue(undefined);
        const prefill = new Date('2026-06-04T12:00:00');
        render(<AddTodoDrawer open onOpenChange={noop} onAdd={onAdd} labels={[]} prefillDate={prefill} />);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Buy milk' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Todo' }));
        await waitFor(() =>
            expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Buy milk', dueDate: isoDay(prefill) }))
        );
    });

    const withFriends = () =>
        vi.mocked(useFriends).mockReturnValue({
            friends: [
                { id: 'f1', username: 'alice' },
                { id: 'f2', username: 'bob' },
            ],
            isLoading: false,
        } as ReturnType<typeof useFriends>);

    it('keeps a todo private when the friend picker is left untouched', async () => {
        withFriends();
        const onAdd = vi.fn().mockResolvedValue(undefined);
        render(<AddTodoDrawer open onOpenChange={noop} onAdd={onAdd} labels={[]} />);
        const switches = await screen.findAllByRole('switch');
        for (const s of switches) expect(s).not.toBeChecked();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Private' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Todo' }));
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ userIds: [] })));
    });

    it('submits only the friends switched on', async () => {
        withFriends();
        const onAdd = vi.fn().mockResolvedValue(undefined);
        render(<AddTodoDrawer open onOpenChange={noop} onAdd={onAdd} labels={[]} />);
        const [alice] = await screen.findAllByRole('switch');
        fireEvent.click(alice);
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Buy milk' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Todo' }));
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ userIds: ['f1'] })));
    });
});
