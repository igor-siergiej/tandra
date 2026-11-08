import type { ListResponse } from '@tandra/types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useListSource } from '../../hooks/useListSource';
import { ListItem } from './ListItem';
import type { ListsListProps } from './types';

// fallow-ignore-next-line complexity
const ListsList = ({ lists, refetch, currentUserId }: ListsListProps) => {
    const navigate = useNavigate();
    const source = useListSource();
    const [editingList, setEditingList] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const { confirm, isOpen, config, handleConfirm, handleCancel } = useConfirmation();

    const handleEditStart = (list: ListResponse) => {
        setEditingList(list.id);
        setEditValue(list.title);
    };

    const handleEditSave = async (list: ListResponse) => {
        if (editValue.trim() && editValue !== list.title) {
            try {
                await source.renameList(list.id, editValue.trim());
                refetch();
            } catch (error) {
                console.error('Error updating list name:', error);
            }
        }

        setEditingList(null);
        setEditValue('');
    };

    const handleEditCancel = () => {
        setEditingList(null);
        setEditValue('');
    };

    const renderedOutput = lists.map((list: ListResponse) => (
        <ListItem
            key={list.id}
            list={list}
            isOwner={list.ownerId === currentUserId}
            currentUserId={currentUserId}
            isEditing={editingList === list.id}
            editValue={editValue}
            onEditChange={setEditValue}
            onEditStart={() => handleEditStart(list)}
            onEditSave={() => handleEditSave(list)}
            onEditCancel={handleEditCancel}
            onDelete={() => {
                confirm({
                    title: 'Delete List?',
                    description: `Are you sure you want to delete "${list.title}"? This action cannot be undone and all items will be permanently removed.`,
                    actionLabel: 'Delete List',
                    onConfirm: async () => {
                        await source.deleteList(list.id);
                        refetch();
                    },
                });
            }}
            onNavigate={() => navigate(`/list/${list.id}`)}
        />
    ));

    return (
        <>
            {renderedOutput}
            <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{config?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{config?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>{config?.cancelLabel || 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            {config?.actionLabel || 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default ListsList;
