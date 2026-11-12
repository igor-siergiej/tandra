import { Download, X } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ImportErrorBanner } from './ImportErrorBanner';

interface LinkImportFieldProps {
    link: string;
    setLink: (link: string) => void;
    isImporting: boolean;
    importError: string;
    disabled?: boolean;
    onImport: () => void;
    onCancelImport: () => void;
}

// Link input + import/cancel button + error banner, mirroring the full-screen ImportScreen's
// shape but embedded in the form; the error block is already split into ImportErrorBanner,
// leaving only the input+button's own branching here.
// fallow-ignore-next-line complexity
export const LinkImportField = ({
    link,
    setLink,
    isImporting,
    importError,
    disabled,
    onImport,
    onCancelImport,
}: LinkImportFieldProps) => (
    <div className="space-y-2">
        <Label>Recipe Link</Label>
        <div className="flex gap-2">
            <Input
                type="url"
                name="recipe-link"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                disabled={disabled || isImporting}
                autoComplete="off"
                inputMode="url"
                className="h-10 border border-foreground/30"
            />
            <Button
                type="button"
                variant="outline"
                onClick={() => (isImporting ? onCancelImport() : onImport())}
                disabled={disabled || (!isImporting && !link.trim())}
                aria-label={isImporting ? 'Cancel import' : 'Import recipe from link'}
                className="h-10 shrink-0 gap-1.5"
            >
                {isImporting ? (
                    <>
                        <X className="h-4 w-4" />
                        Cancel
                    </>
                ) : (
                    <>
                        <Download className="h-4 w-4" />
                        Import
                    </>
                )}
            </Button>
        </div>
        <p className="text-xs text-muted-foreground">
            Paste a recipe URL and tap Import to auto-fill the fields below.
        </p>
        <ImportErrorBanner importError={importError} isImporting={isImporting} link={link} onRetry={onImport} />
    </div>
);
