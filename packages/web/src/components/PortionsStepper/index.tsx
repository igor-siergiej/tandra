'use client';

import { Minus, Plus } from 'lucide-react';

import { Button } from '../ui/button';

interface PortionsStepperProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
}

export const PortionsStepper = ({ value, onChange, min = 1 }: PortionsStepperProps) => {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Portions</span>
            <div className="flex items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    disabled={value <= min}
                    aria-label="Decrease portions"
                >
                    <Minus className="size-4" />
                </Button>
                <span className="w-6 text-center font-semibold tabular-nums" data-testid="portions-value">
                    {value}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onChange(value + 1)}
                    aria-label="Increase portions"
                >
                    <Plus className="size-4" />
                </Button>
            </div>
        </div>
    );
};
