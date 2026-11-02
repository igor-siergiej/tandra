import type { Label } from '@tandra/types';

export interface LabelFilterProps {
    labels: Label[];
    active: Set<string>;
    onToggle: (labelId: string) => void;
}

export const LabelFilter = ({ labels, active, onToggle }: LabelFilterProps) => {
    if (labels.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 py-2">
            {labels.map((label) => {
                const on = active.has(label.id);

                return (
                    <button
                        type="button"
                        key={label.id}
                        onClick={() => onToggle(label.id)}
                        className={[
                            'rounded-full px-3 py-1 text-xs border flex items-center gap-1.5',
                            on ? 'border-primary' : 'border-transparent bg-muted/40',
                        ].join(' ')}
                    >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                        {label.name}
                    </button>
                );
            })}
        </div>
    );
};
