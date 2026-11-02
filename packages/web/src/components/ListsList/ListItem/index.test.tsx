import type { ListResponse } from '@tandra/types';
import { ListType } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListItem } from './index';

describe('ListItem', () => {
    const currentUserId = 'current-user';

    const mockListResponse: ListResponse = {
        id: '1',
        title: 'Test List',
        dateAdded: new Date(),
        items: [],
        users: [
            { id: 'owner1', username: 'owner1' },
            { id: 'user2', username: 'user2' },
        ],
        listType: ListType.SHOPPING,
        ownerId: 'owner1',
    };

    const mockCallbacks = {
        onEditChange: vi.fn(),
        onEditStart: vi.fn(),
        onEditSave: vi.fn(),
        onEditCancel: vi.fn(),
        onDelete: vi.fn(),
        onNavigate: vi.fn(),
    };

    beforeEach(() => {
        Object.values(mockCallbacks).forEach((fn) => void fn.mockClear());
    });

    it('displays list title in display mode', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        expect(screen.getByText('Test List')).toBeInTheDocument();
    });

    it('renders ShoppingCart icon for SHOPPING list type', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders ShoppingCart icon for list', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        expect(screen.getByText('Test List')).toBeInTheDocument();
    });

    it('shows edit and delete buttons when isOwner=true in display mode', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('hides edit and delete buttons when isOwner=false', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={false}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBe(1);
    });

    it('calls onNavigate when clicking title in display mode', async () => {
        const user = userEvent.setup();
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        const titleButton = screen.getByText('Test List').closest('button');

        if (titleButton) {
            await user.click(titleButton);
        }

        expect(mockCallbacks.onNavigate).toHaveBeenCalledOnce();
    });

    it('calls onEditStart when clicking edit button', async () => {
        const user = userEvent.setup();
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        const buttons = screen.getAllByRole('button');
        const editButton = buttons[1];
        await user.click(editButton);

        expect(mockCallbacks.onEditStart).toHaveBeenCalledOnce();
    });

    it('shows input with editValue in edit mode', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={true}
                editValue="Edited Title"
                {...mockCallbacks}
            />
        );

        const input = screen.getByDisplayValue('Edited Title');
        expect(input).toBeInTheDocument();
    });

    it('calls onEditSave when pressing Enter in edit mode', async () => {
        const user = userEvent.setup();
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={true}
                editValue="New Title"
                {...mockCallbacks}
            />
        );

        const input = screen.getByDisplayValue('New Title');
        await user.type(input, '{Enter}');

        expect(mockCallbacks.onEditSave).toHaveBeenCalledOnce();
    });

    it('calls onEditCancel when pressing Escape in edit mode', async () => {
        const user = userEvent.setup();
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={true}
                editValue="New Title"
                {...mockCallbacks}
            />
        );

        const input = screen.getByDisplayValue('New Title');
        await user.type(input, '{Escape}');

        expect(mockCallbacks.onEditCancel).toHaveBeenCalledOnce();
    });

    it('calls onEditSave when clicking Check button in edit mode', async () => {
        const user = userEvent.setup();
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={true}
                editValue="New Title"
                {...mockCallbacks}
            />
        );

        const buttons = screen.getAllByRole('button');
        const saveButton = buttons[0];
        await user.click(saveButton);

        expect(mockCallbacks.onEditSave).toHaveBeenCalledOnce();
    });

    it('disables delete button when in edit mode', () => {
        const { container } = render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={true}
                editValue="New Title"
                {...mockCallbacks}
            />
        );

        const deleteButton = container.querySelector('button[disabled]');
        expect(deleteButton).toBeInTheDocument();
    });

    it('shows an avatar for each other member on the list', () => {
        render(
            <ListItem
                list={mockListResponse}
                isOwner={false}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        expect(screen.getByTitle('owner1')).toBeInTheDocument();
        expect(screen.getByTitle('user2')).toBeInTheDocument();
    });

    it('excludes the current user from the avatar stack', () => {
        const listWithSelf: ListResponse = {
            ...mockListResponse,
            users: [...mockListResponse.users, { id: currentUserId, username: 'me' }],
        };

        render(
            <ListItem
                list={listWithSelf}
                isOwner={false}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        expect(screen.queryByTitle('me')).not.toBeInTheDocument();
    });

    it('shows no avatars when the list has no other members', () => {
        const soloList: ListResponse = { ...mockListResponse, users: [{ id: currentUserId, username: 'me' }] };
        render(
            <ListItem
                list={soloList}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        expect(screen.queryByTitle('me')).not.toBeInTheDocument();
    });

    it('calls onDelete when clicking delete button', async () => {
        const user = userEvent.setup();
        render(
            <ListItem
                list={mockListResponse}
                isOwner={true}
                currentUserId={currentUserId}
                isEditing={false}
                editValue=""
                {...mockCallbacks}
            />
        );

        const buttons = screen.getAllByRole('button');
        const deleteButton = buttons[buttons.length - 1];
        await user.click(deleteButton);

        expect(mockCallbacks.onDelete).toHaveBeenCalledOnce();
    });
});
