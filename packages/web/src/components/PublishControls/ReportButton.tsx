import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { useState } from 'react';

import { reportDiscoveryRecipe } from '../../api';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

const MAX_REASON = 500;

// Lets anyone flag a public recipe for an admin to look at. One report per person per recipe; reporting again just
// replaces the reason, so there is nothing to spam.
// Dialog with reason field plus sending, failed and sent states.
// fallow-ignore-next-line complexity
export const ReportButton = ({ recipeId }: { recipeId: string }) => {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');

    const report = useMutation({
        mutationFn: () => reportDiscoveryRecipe(recipeId, reason.trim() || undefined),
        onSuccess: () => setOpen(false),
    });

    if (report.isSuccess && !open) {
        return <p className="text-xs text-muted-foreground">Thanks, we'll take a look.</p>;
    }

    return (
        <>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
                <Flag className="h-3.5 w-3.5" />
                Report
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Report this recipe</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tell us what is wrong with it (offensive, spam, copied from somewhere). It stays visible
                            until an admin has looked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={MAX_REASON}
                        placeholder="What is wrong with it? (optional)"
                        aria-label="Reason for the report"
                    />
                    {report.isError && (
                        <p role="alert" className="text-xs text-destructive">
                            Could not send the report. Please try again.
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button disabled={report.isPending} onClick={() => report.mutate()}>
                            {report.isPending ? 'Sending...' : 'Send report'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
