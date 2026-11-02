import type { Label as LabelType } from '@tandra/types';

import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const NONE = '__none__';

export interface LabelSelectProps {
    labels: LabelType[];
    value: string | undefined; // labelId
    onChange: (labelId: string | undefined) => void;
}

export const LabelSelect = ({ labels, value, onChange }: LabelSelectProps) => (
    <div className="space-y-2">
        <Label>Label (Optional)</Label>
        <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
            <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="No label" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>No label</SelectItem>
                {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                        <span className="inline-flex items-center gap-2">
                            <span
                                className="inline-block h-3 w-3 rounded-full"
                                style={{ backgroundColor: label.color }}
                            />
                            {label.name}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);
