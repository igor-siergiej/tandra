import * as React from 'react';

import { cn } from '../../lib/utils';

// Canonical mobile-keyboard attribute sets, applied by `purpose` so every input across the
// app requests the same keyboard/autocomplete/capitalization behavior for a given kind of
// field instead of each call site guessing its own subset. An explicit prop on the caller
// (e.g. PinnedSearchField's own inputMode="search") always wins — presets only fill gaps.
export type InputPurpose = 'text' | 'name' | 'search' | 'url' | 'number';

type PurposeAttrs = Pick<InputProps, 'inputMode' | 'autoComplete' | 'autoCapitalize' | 'spellCheck' | 'enterKeyHint'>;

const PURPOSE_PRESETS: Record<InputPurpose, PurposeAttrs> = {
    text: {
        inputMode: 'text',
        autoComplete: 'off',
        autoCapitalize: 'sentences',
        spellCheck: true,
        enterKeyHint: 'done',
    },
    name: {
        inputMode: 'text',
        autoComplete: 'off',
        autoCapitalize: 'words',
        spellCheck: false,
        enterKeyHint: 'done',
    },
    search: {
        inputMode: 'search',
        autoComplete: 'off',
        autoCapitalize: 'none',
        spellCheck: false,
        enterKeyHint: 'search',
    },
    url: {
        inputMode: 'url',
        autoComplete: 'off',
        autoCapitalize: 'none',
        spellCheck: false,
        enterKeyHint: 'done',
    },
    number: {
        inputMode: 'decimal',
        autoComplete: 'off',
        autoCapitalize: 'none',
        spellCheck: false,
        enterKeyHint: 'done',
    },
};

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { purpose?: InputPurpose };

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, purpose, ...props }, ref) => {
    const preset = purpose ? PURPOSE_PRESETS[purpose] : undefined;

    return (
        <input
            type={type}
            className={cn(
                'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                // type="search" fields (used to stop mobile address/card autofill) would otherwise
                // show the browser's system-blue clear button; PinnedSearchField draws its own.
                '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
                className
            )}
            ref={ref}
            {...preset}
            {...props}
        />
    );
});

Input.displayName = 'Input';

export { Input };
