import { TagsField } from '../../components/TagsField';

interface TagsSectionProps {
    tags: string[];
    isOwner?: boolean;
    isEditing: boolean;
    onChange: (tags: string[]) => void;
}

// View-only chips when not editing; adding and removing tags — the add/remove editor shared
// with AddRecipePage's manual tag entry — only happens while the page is in edit mode, matching
// every other field on this page (no standalone always-on per-tag delete outside edit mode).
export const TagsSection = ({ tags, isOwner = false, isEditing, onChange }: TagsSectionProps) => {
    if (isEditing) {
        if (!isOwner) return null;

        return (
            <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tags</p>
                <TagsField tags={tags} onChange={onChange} />
            </div>
        );
    }

    if (tags.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
                <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                >
                    {tag}
                </span>
            ))}
        </div>
    );
};
