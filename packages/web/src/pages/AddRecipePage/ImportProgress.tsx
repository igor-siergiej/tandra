import { Check, Loader2 } from 'lucide-react';

// A URL import is two awaited legs, one request each: POST /api/recipes/import (page
// fetch + parse, possibly two LLM calls) and — only when that found a cover image —
// GET /api/recipes/import/image. Neither streams progress, so which leg is in flight is
// all the granularity there is to show.
export type ImportStage = 'idle' | 'fetching' | 'image';

type StageStatus = 'done' | 'active' | 'pending';

const STAGES: Array<{ stage: Exclude<ImportStage, 'idle'>; label: string; detail: string }> = [
    {
        stage: 'fetching',
        label: 'Reading the recipe page',
        detail: 'Fetching the page and pulling out ingredients and steps — this can take a few seconds.',
    },
    {
        stage: 'image',
        label: 'Fetching the cover photo',
        detail: 'Ingredients and steps are in. Grabbing the recipe photo.',
    },
];

const LABEL_CLASS: Record<StageStatus, string> = {
    done: 'text-foreground',
    active: 'font-medium text-foreground',
    pending: 'text-muted-foreground/70',
};

const StageIcon = ({ status }: { status: StageStatus }) => {
    if (status === 'done') {
        return <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />;
    }

    if (status === 'active') {
        return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />;
    }

    return <span className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />;
};

const StageRow = ({ label, index, activeIndex }: { label: string; index: number; activeIndex: number }) => {
    const status: StageStatus = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';

    return (
        <li aria-current={status === 'active' ? 'step' : undefined} className="flex items-center gap-2 text-sm">
            <StageIcon status={status} />
            <span className={LABEL_CLASS[status]}>{label}</span>
        </li>
    );
};

export const ImportProgress = ({ stage }: { stage: ImportStage }) => {
    if (stage === 'idle') return null;

    const activeIndex = STAGES.findIndex((entry) => entry.stage === stage);

    return (
        <output
            aria-live="polite"
            className="block space-y-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
        >
            <p className="text-xs text-muted-foreground">{STAGES[activeIndex].detail}</p>
            <ol className="flex flex-col gap-1.5">
                {STAGES.map((entry, index) => (
                    <StageRow key={entry.stage} label={entry.label} index={index} activeIndex={activeIndex} />
                ))}
            </ol>
        </output>
    );
};
