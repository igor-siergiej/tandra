import { AlertTriangle } from 'lucide-react';

import { Button } from '../../components/ui/button';

interface ErrorStateProps {
    onRetry: () => void;
}

export const ErrorState = ({ onRetry }: ErrorStateProps) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex items-center gap-3 text-destructive mb-3">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-semibold">Unable to load recipe</span>
        </div>
        <p className="text-muted-foreground mb-4 max-w-sm">Please check your connection and try again.</p>
        <Button variant="default" onClick={onRetry}>
            Retry
        </Button>
    </div>
);
