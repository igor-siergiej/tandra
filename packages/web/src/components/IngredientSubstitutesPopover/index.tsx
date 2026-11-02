import { Replace } from 'lucide-react';
import { useEffect, useState } from 'react';

import { suggestIngredientSubstitutes } from '../../api';
import { useAiFeatures } from '../../utils/useAiFeatures';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface IngredientSubstitutesPopoverProps {
    ingredientName: string;
    recipeTitle?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';
// fallow-ignore-next-line complexity
const SubstitutesContent = ({
    status,
    substitutes,
    errorMessage,
}: {
    status: Status;
    substitutes: string[];
    errorMessage: string;
}) => {
    if (status === 'loading') {
        return <p className="text-sm text-muted-foreground">Thinking…</p>;
    }
    if (status === 'error') {
        return <p className="text-sm text-destructive">{errorMessage}</p>;
    }
    if (status === 'success') {
        if (substitutes.length === 0) {
            return <p className="text-sm text-muted-foreground">No substitutes found.</p>;
        }
        return (
            <ul className="text-sm space-y-1">
                {substitutes.map((substitute) => (
                    <li key={substitute}>{substitute}</li>
                ))}
            </ul>
        );
    }
    return null;
};

// Small per-ingredient "suggest a substitute" affordance: clicking reveals an inline popover
// (no dedicated page/drawer) that lazily fetches AI-generated substitutes on first open, then
// caches the result for the component's lifetime so re-opening doesn't re-trigger the LLM call.
export const IngredientSubstitutesPopover = ({ ingredientName, recipeTitle }: IngredientSubstitutesPopoverProps) => {
    const { ingredientSubstitutes } = useAiFeatures();
    const [status, setStatus] = useState<Status>('idle');
    const [substitutes, setSubstitutes] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [open, setOpen] = useState(false);

    // Dismiss the popover on scroll, matching the in-page menu behaviour users expect
    // (Escape, outside-press). Scrolling inside the popover content is ignored by
    // checking the event target — the popover sits in a portal so its scroll events
    // still bubble through `window`, but the target itself lives inside
    // [data-radix-popper-content-wrapper].
    useEffect(() => {
        if (!open) return;
        const handleScroll = (event: Event) => {
            if (event.target instanceof Element && event.target.closest('[data-radix-popper-content-wrapper]')) {
                return;
            }
            setOpen(false);
        };
        window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', handleScroll, { capture: true });
    }, [open]);

    // fallow-ignore-next-line complexity
    const handleOpenChange = async (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen || status !== 'idle') return;
        if (!ingredientSubstitutes) {
            setErrorMessage('Not available on this server');
            setStatus('error');
            return;
        }
        setStatus('loading');
        try {
            const result = await suggestIngredientSubstitutes(ingredientName, recipeTitle);
            setSubstitutes(result.substitutes);
            setStatus('success');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load substitutes');
            setStatus('error');
        }
    };

    return (
        <Popover open={open} onOpenChange={(o) => void handleOpenChange(o)}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`Suggest substitutes for ${ingredientName}`}
                    disabled={!ingredientSubstitutes}
                    title={ingredientSubstitutes ? undefined : 'Not available on this server'}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Replace className="h-4 w-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Substitutes</p>
                <SubstitutesContent status={status} substitutes={substitutes} errorMessage={errorMessage} />
            </PopoverContent>
        </Popover>
    );
};
