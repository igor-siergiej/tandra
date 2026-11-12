import type { Label as LabelType, Recurrence } from '@tandra/types';

import { DueDateField } from '../DueDateField';
import { LabelSelect } from '../LabelSelect';
import { RecurrenceField } from '../RecurrenceField';
import { TodoTimeField } from '../TodoTimeField';

export interface TodoFieldsProps {
    labels: LabelType[];
    dueDate: Date | undefined;
    onDueDateChange: (date: Date | undefined) => void;
    time: string | undefined;
    onTimeChange: (time: string | undefined) => void;
    labelId: string | undefined;
    onLabelIdChange: (labelId: string | undefined) => void;
    recurrence: Recurrence | undefined;
    onRecurrenceChange: (recurrence: Recurrence | undefined) => void;
}

export const TodoFields = (props: TodoFieldsProps) => (
    <>
        <DueDateField value={props.dueDate} onChange={props.onDueDateChange} captionLayout="dropdown" />
        <TodoTimeField value={props.time} onChange={props.onTimeChange} />
        <LabelSelect labels={props.labels} value={props.labelId} onChange={props.onLabelIdChange} />
        <RecurrenceField value={props.recurrence} onChange={props.onRecurrenceChange} />
    </>
);
