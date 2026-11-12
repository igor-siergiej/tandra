import { Search, X } from 'lucide-react';

import { Input } from '../ui/input';

interface PinnedSearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Form field name; also distinguishes the two search surfaces in autofill history. */
    name: string;
    autoFocus?: boolean;
}

// Bottom-pinned, keyboard-safe search field: sticky to the bottom of Layout's scroll container
// and offset by env(keyboard-inset-height) so the on-screen keyboard can never cover it, which
// is what makes results "build upward" toward the thumb. The background band spans the content
// column (masking content scrolling underneath) while the field itself stays capped, so it does
// not stretch across the full width wide routes like /recipes get on desktop.
export const PinnedSearchField = ({ value, onChange, placeholder, name, autoFocus }: PinnedSearchFieldProps) => (
    <div className="sticky bottom-0 mt-6 py-2 bg-background z-10" style={{ bottom: 'env(keyboard-inset-height, 0px)' }}>
        <div className="relative mx-auto w-full max-w-[500px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="pl-9 pr-9"
                name={name}
                autoComplete="off"
                inputMode="search"
                autoFocus={autoFocus}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    </div>
);
