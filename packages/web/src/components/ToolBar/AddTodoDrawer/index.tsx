import { isoDay, type Label as LabelType, type Recurrence } from '@tandra/types';
import { Plus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { CreateTodoBody } from '../../../api';
import { FriendPicker } from '../../../components/FriendPicker';
import { TodoFields } from '../../../components/TodoFields';
import { Button } from '../../../components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '../../../components/ui/drawer';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RippleButton } from '../../../components/ui/ripple';

interface BuildTodoBodyArgs {
    title: string;
    dueDate?: Date;
    time?: string;
    labelId?: string;
    recurrence?: Recurrence;
    userIds?: string[];
}

const buildTodoBody = ({ title, dueDate, userIds, ...rest }: BuildTodoBodyArgs): CreateTodoBody => {
    const body: CreateTodoBody = { title, ...rest };

    // Serialize the picked Date as a tz-agnostic day so the server-side reminder can't drift it.
    if (dueDate !== undefined) body.dueDate = isoDay(dueDate);

    // Sent even when empty: the API reads a missing list as "share with every friend".
    if (userIds !== undefined) body.userIds = userIds;

    return body;
};

export interface AddTodoDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (body: CreateTodoBody) => Promise<void>;
    labels: LabelType[];
    prefillDate?: Date;
}

export const AddTodoDrawer = ({ open, onOpenChange, onAdd, labels, prefillDate }: AddTodoDrawerProps) => {
    const titleId = useId();
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(prefillDate);
    const [time, setTime] = useState<string | undefined>(undefined);
    const [labelId, setLabelId] = useState<string | undefined>(undefined);
    const [recurrence, setRecurrence] = useState<Recurrence | undefined>(undefined);
    const [shareWith, setShareWith] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) setDueDate(prefillDate);
    }, [open, prefillDate]);

    const reset = () => {
        setTitle('');
        setDueDate(prefillDate);
        setTime(undefined);
        setLabelId(undefined);
        setRecurrence(undefined);
        setShareWith([]);
        setError('');
    };

    const handleSubmit = async () => {
        const trimmed = title.trim();

        if (!trimmed) {
            setError('Title is required');

            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await onAdd(buildTodoBody({ title: trimmed, dueDate, time, labelId, recurrence, userIds: shareWith }));
            reset();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add todo');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        reset();
        onOpenChange(false);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>
                <RippleButton
                    size="icon"
                    data-testid="add-todo-trigger"
                    className="h-12 w-12 rounded-full border-2 border-primary/20 hover:border-primary/40 transition-colors"
                >
                    <Plus className="size-5" />
                </RippleButton>
            </DrawerTrigger>
            <DrawerContent>
                <div className="flex min-h-0 w-full flex-1 flex-col sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader className="flex-none">
                        <DrawerTitle>Add Todo</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex-1 overflow-y-auto p-4 pb-0 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={titleId}>Title</Label>
                            <Input
                                id={titleId}
                                value={title}
                                purpose="name"
                                autoFocus
                                className={`${error ? 'border-destructive' : ''} h-12 text-base`}
                                onChange={(e) => {
                                    setError('');
                                    setTitle(e.target.value);
                                }}
                                placeholder="Enter todo title..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSubmit();
                                    else if (e.key === 'Escape') handleCancel();
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
                        <div className="space-y-2">
                            <Label>Share with friends</Label>
                            {/* No seeding: a todo is private until the user picks who to share it with. */}
                            <FriendPicker value={shareWith} onChange={setShareWith} />
                        </div>
                    </div>
                    <DrawerFooter className="flex-none">
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? 'Adding…' : 'Add Todo'}
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline" onClick={handleCancel}>
                                Cancel
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
