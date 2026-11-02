import type { Recurrence } from '@tandra/types';

import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const NONE = 'none';

type Freq = Recurrence['freq'];

export interface RecurrenceFieldProps {
    value: Recurrence | undefined;
    onChange: (value: Recurrence | undefined) => void;
}

export const RecurrenceField = ({ value, onChange }: RecurrenceFieldProps) => {
    const freq: Freq | typeof NONE = value?.freq ?? NONE;

    const setFreq = (next: string) => {
        if (next === NONE) {
            onChange(undefined);
        } else {
            onChange({ freq: next as Freq, interval: value?.interval ?? 1 });
        }
    };

    const setInterval = (raw: string) => {
        if (!value) return;
        const n = Math.max(1, parseInt(raw, 10) || 1);
        onChange({ ...value, interval: n });
    };

    return (
        <div className="space-y-2">
            <Label>Repeat</Label>
            <Select value={freq} onValueChange={setFreq}>
                <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
            </Select>
            {value && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Every</span>
                    <Input
                        purpose="number"
                        type="number"
                        min={1}
                        className="h-10 w-20"
                        value={value.interval}
                        onChange={(e) => setInterval(e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">{value.freq.replace('ly', '(s)')}</span>
                </div>
            )}
        </div>
    );
};
