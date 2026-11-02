import type { Label as LabelType, Recurrence, Todo } from '@tandra/types';
import { useId, useState } from 'react';

import type { UpdateTodoBody } from '../../../api';
import { TodoFields } from '../../TodoFields';
import { Button } from '../../ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../../ui/drawer';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { buildUpdateBody } from './buildUpdateBody';

export interface EditTodoDrawerProps {
    todo: Todo | null;
    labels: LabelType[];
    onOpenChange: (open: boolean) => void;
    onSave: (id: string, body: UpdateTodoBody) => Promise<unknown> | undefined;
}

const parseDay = (day: string): Date => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
};

interface EditTodoFormProps extends Omit<EditTodoDrawerProps, 'todo' | 'onOpenChange'> {
    todo: Todo;
    onDone: () => void;
}

const EditTodoForm = ({ todo, labels, onSave, onDone }: EditTodoFormProps) => {
    const titleId = useId();
    const [title, setTitle] = useState(todo.title);
    const [dueDate, setDueDate] = useState<Date | undefined>(todo.dueDate ? parseDay(todo.dueDate) : undefined);
    const [time, setTime] = useState<string | undefined>(todo.time);
    const [labelId, setLabelId] = useState<string | undefined>(todo.labelId);
    const [recurrence, setRecurrence] = useState<Recurrence | undefined>(todo.recurrence);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            setError('Title is required');
            return;
        }
        await onSave(todo.id, buildUpdateBody(todo, { title: trimmed, dueDate, time, labelId, recurrence }));
        onDone();
    };

    return (
        <div className="flex min-h-0 w-full flex-1 flex-col sm:mx-auto sm:max-w-[400px]">
            <DrawerHeader className="flex-none">
                <DrawerTitle>Edit Todo</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto p-4 pb-0 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor={titleId}>Title</Label>
                    <Input
                        id={titleId}
                        value={title}
                        purpose="name"
                        className={`${error ? 'border-destructive' : ''} h-12 text-base`}
                        onChange={(e) => {
                            setError('');
                            setTitle(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSave();
                        }}
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <TodoFields
                    labels={labels}
                    dueDate={dueDate}
                    onDueDateChange={setDueDate}
                    time={time}
                    onTimeChange={setTime}
                    labelId={labelId}
                    onLabelIdChange={setLabelId}
                    recurrence={recurrence}
                    onRecurrenceChange={setRecurrence}
                />
            </div>
            <DrawerFooter className="flex-none">
                <Button onClick={handleSave}>Save</Button>
                <DrawerClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DrawerClose>
            </DrawerFooter>
        </div>
    );
};

export const EditTodoDrawer = ({ todo, labels, onOpenChange, onSave }: EditTodoDrawerProps) => (
    <Drawer open={todo !== null} onOpenChange={onOpenChange}>
        <DrawerContent>
            {todo && (
                <EditTodoForm
                    key={todo.id}
                    todo={todo}
                    labels={labels}
                    onSave={onSave}
                    onDone={() => onOpenChange(false)}
                />
            )}
        </DrawerContent>
    </Drawer>
);
