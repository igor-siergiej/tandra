import { useState } from 'react';

import { StepsList } from '../../components/StepsList';
import { Textarea } from '../../components/ui/textarea';
import { splitIntoSteps } from '../../utils/splitIntoSteps';

interface InstructionsSectionProps {
    instructions: string[];
    isOwner?: boolean | null;
    isEditing: boolean;
    onChange: (instructions: string[]) => void;
}

// View/edit toggle with a paste-text/step-list sub-toggle for instructions; edit mode is now
// externally controlled by the page's single Edit/Save/Cancel — only the paste-vs-steps
// presentation toggle (and its scratch paste text) stays local to this component.
// fallow-ignore-next-line complexity
export const InstructionsSection = ({ instructions, isOwner, isEditing, onChange }: InstructionsSectionProps) => {
    const [showPaste, setShowPaste] = useState(false);
    const [pasteText, setPasteText] = useState('');

    if (!isEditing) {
        return (
            <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Instructions</p>
                {instructions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No instructions added yet.</p>
                ) : (
                    <div className="space-y-1">
                        {instructions.map((step, i) => (
                            <div
                                key={`${i}-${step.slice(0, 20)}`}
                                className="flex items-start gap-2 px-3 py-2 rounded-md bg-card border border-border text-sm"
                            >
                                <span className="font-semibold text-muted-foreground min-w-[1.25rem]">{i + 1}.</span>
                                <span className="text-foreground">{step}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (!isOwner) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Instructions</p>
                <button
                    type="button"
                    onClick={() => setShowPaste(!showPaste)}
                    className="text-xs text-muted-foreground underline"
                >
                    {showPaste ? 'back to steps' : 'paste text ↩'}
                </button>
            </div>

            {showPaste ? (
                <Textarea
                    placeholder="Paste instructions here — each line becomes a step automatically..."
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    onBlur={() => {
                        const parsed = splitIntoSteps(pasteText);
                        if (parsed.length > 0) {
                            onChange(parsed);
                            setShowPaste(false);
                            setPasteText('');
                        }
                    }}
                    className="min-h-[100px] resize-none"
                />
            ) : (
                <StepsList steps={instructions} onChange={onChange} />
            )}
        </div>
    );
};
