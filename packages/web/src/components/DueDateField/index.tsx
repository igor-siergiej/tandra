import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { Calendar } from '../../components/ui/calendar';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { parseNaturalDate } from '../../utils/parseNaturalDate';

export interface DueDateFieldProps {
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
    captionLayout?: 'dropdown' | 'label';
}

const NaturalDateInput = ({ onCommit }: { onCommit: (date: Date) => void }) => {
    const [text, setText] = useState('');
    const parsed = parseNaturalDate(text);

    const commit = () => {
        if (parsed) {
            onCommit(parsed);
            setText('');
        }
    };

    return (
        <div className="mb-3 space-y-1">
            <Input
                purpose="text"
                value={text}
                placeholder="e.g. tomorrow, next friday"
                aria-label="Natural language date"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                    }
                }}
                onBlur={commit}
            />
            {text.trim() && (
                <p className="text-xs text-muted-foreground" data-testid="nl-date-preview">
                    {parsed ? `→ ${format(parsed, 'EEE d MMM yyyy')}` : 'Unrecognized date'}
                </p>
            )}
        </div>
    );
};

export const DueDateField = ({ value, onChange, captionLayout }: DueDateFieldProps) => {
    return (
        <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        data-empty={!value}
                        className="data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal h-10"
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {value ? format(value, 'dd/MM/yyyy') : 'Pick a date'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-fit overflow-visible p-4 max-w-xs" align="start" side="top" sideOffset={4}>
                    <NaturalDateInput onCommit={onChange} />
                    <div style={{ '--cell-size': '3.5rem' } as React.CSSProperties}>
                        <Calendar
                            mode="single"
                            selected={value}
                            onSelect={onChange}
                            {...(captionLayout && { captionLayout })}
                        />
                    </div>
                </PopoverContent>
            </Popover>
            {value && (
                <button
                    type="button"
                    aria-label="Clear due date"
                    className="text-xs text-muted-foreground underline mt-1"
                    onClick={() => onChange(undefined)}
                >
                    Clear due date
                </button>
            )}
        </div>
    );
};
