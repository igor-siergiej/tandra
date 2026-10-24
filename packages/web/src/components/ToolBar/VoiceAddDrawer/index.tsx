import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseSpokenItems, type SpokenItem } from '../../../api';
import { useKeepListening } from '../../../hooks/useKeepListening';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import { useVoiceAck } from '../../../hooks/useVoiceAck';
import { Button } from '../../ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../../ui/drawer';
import { VoiceNotice } from './VoiceNotice';

export interface VoiceAddDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAddMany: (items: Array<SpokenItem>) => Promise<void>;
}

const describe = (item: SpokenItem) => [item.quantity, item.unit].filter((part) => part !== undefined).join(' ');

// One small state machine (listen -> parse -> confirm -> add); splitting it would scatter the flow.
// fallow-ignore-next-line complexity
export const VoiceAddDrawer = ({ open, onOpenChange, onAddMany }: VoiceAddDrawerProps) => {
    const [keepListening] = useKeepListening();
    const speech = useSpeechRecognition({ keepListening });
    const [acknowledged, acknowledge] = useVoiceAck();
    const [showNotice, setShowNotice] = useState(false);
    const [parsed, setParsed] = useState<Array<SpokenItem> | null>(null);
    const [kept, setKept] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    // The transcript already sent to the parser; without it a failed parse clears `busy`, re-runs the effect and loops.
    const parsedTranscript = useRef('');

    // Reset whenever the drawer is dismissed so the next open starts clean.
    useEffect(() => {
        if (open) return;
        speech.reset();
        parsedTranscript.current = '';
        setParsed(null);
        setKept(new Set());
        setFailure(null);
        setBusy(false);
        setShowNotice(false);
    }, [open, speech.reset]);

    // Once recognition ends with something heard, turn it into items to confirm.
    // fallow-ignore-next-line complexity
    useEffect(() => {
        if (speech.listening || !speech.transcript || parsed || busy) return;
        if (parsedTranscript.current === speech.transcript) return;
        parsedTranscript.current = speech.transcript;
        setBusy(true);
        setFailure(null);
        parseSpokenItems(speech.transcript)
            .then((items) => {
                setParsed(items);
                setKept(new Set(items.map((_, index) => index)));
                if (items.length === 0) setFailure("I couldn't find any items in that. Try again.");
            })
            .catch((error: unknown) => {
                setFailure(error instanceof Error ? error.message : 'Could not understand that. Try again.');
            })
            .finally(() => setBusy(false));
    }, [speech.listening, speech.transcript, parsed, busy]);

    const toggle = (index: number) =>
        setKept((current) => {
            const next = new Set(current);
            if (!next.delete(index)) next.add(index);
            return next;
        });

    const listen = () => {
        parsedTranscript.current = '';
        setParsed(null);
        setFailure(null);
        speech.start();
    };

    // The mic stays closed until the user has seen where their speech goes (the privacy notice promises this).
    const retry = () => {
        if (acknowledged) return listen();
        setShowNotice(true);
    };

    const acknowledgeAndListen = () => {
        acknowledge();
        setShowNotice(false);
        listen();
    };

    const confirm = async () => {
        if (!parsed) return;
        setBusy(true);
        try {
            await onAddMany(parsed.filter((_, index) => kept.has(index)));
            onOpenChange(false);
        } catch (error) {
            setFailure(error instanceof Error ? error.message : 'Failed to add items');
        } finally {
            setBusy(false);
        }
    };

    const error = speech.error ?? failure;
    const showResults = parsed !== null && parsed.length > 0;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader>
                        <DrawerTitle>{showNotice ? 'Before you speak' : 'Add by voice'}</DrawerTitle>
                    </DrawerHeader>
                    <div className="space-y-4 p-4 pb-0">
                        {showNotice && <VoiceNotice onAcknowledge={acknowledgeAndListen} />}
                        {!showNotice && !showResults && (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <Button
                                    type="button"
                                    size="icon"
                                    className="h-16 w-16 rounded-full"
                                    aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
                                    onClick={speech.listening ? speech.stop : retry}
                                    disabled={busy}
                                >
                                    {speech.listening ? <Square className="size-6" /> : <Mic className="size-6" />}
                                </Button>
                                <p className="min-h-10 text-center text-sm text-muted-foreground" aria-live="polite">
                                    {busy
                                        ? 'Working out your list…'
                                        : speech.transcript ||
                                          (speech.listening ? 'Listening…' : 'Tap the mic and say what you need')}
                                </p>
                            </div>
                        )}
                        {showResults && (
                            <ul className="space-y-2" aria-label="Items heard">
                                {parsed.map((item, index) => (
                                    <li key={`${item.name}-${index}`}>
                                        <label className="flex items-center gap-3 rounded-lg border p-3">
                                            <input
                                                type="checkbox"
                                                checked={kept.has(index)}
                                                onChange={() => toggle(index)}
                                            />
                                            <span className="flex-1">{item.name}</span>
                                            <span className="text-sm text-muted-foreground">{describe(item)}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {error && (
                            <p className="text-sm text-destructive" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                    <DrawerFooter>
                        {showResults && (
                            <Button onClick={confirm} disabled={busy || kept.size === 0}>
                                {kept.size === 1 ? 'Add 1 item' : `Add ${kept.size} items`}
                            </Button>
                        )}
                        {showResults && (
                            <Button variant="outline" onClick={retry} disabled={busy}>
                                Say it again
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
