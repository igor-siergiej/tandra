import { X } from 'lucide-react';
import { useState } from 'react';

import { Input } from '../../components/ui/input';

interface TagsFieldProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    disabled?: boolean;
}

const commitTag = (tags: string[], raw: string): string[] => {
    const next = raw.trim();
    if (!next) return tags;
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) return tags;
    return [...tags, next];
};

// Enter or comma commits the current text as a removable chip; free text, no fixed vocabulary.
export const TagsField = ({ tags, onChange, disabled }: TagsFieldProps) => {
    const [draft, setDraft] = useState('');

    const commit = () => {
        onChange(commitTag(tags, draft));
        setDraft('');
    };

    return (
        <div className="space-y-2">
            <Input
                type="search"
                placeholder="Add a tag and press Enter..."
                value={draft}
                disabled={disabled}
                onChange={(e) => {
                    const value = e.target.value;
                    if (value.endsWith(',')) {
                        onChange(commitTag(tags, value.slice(0, -1)));
                        setDraft('');
                        return;
                    }
                    setDraft(value);
                }}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    commit();
                }}
                onBlur={commit}
                name="recipe-tag"
                autoComplete="off"
                inputMode="text"
                className="h-10 border border-foreground/30"
            />
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                        >
                            {tag}
                            <button
                                type="button"
                                aria-label={`Remove tag ${tag}`}
                                onClick={() => onChange(tags.filter((t) => t !== tag))}
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};
