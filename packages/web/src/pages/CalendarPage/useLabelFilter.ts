import { useState } from 'react';

export const useLabelFilter = () => {
    const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());

    const toggleLabel = (labelId: string) =>
        setActiveLabels((prev) => {
            const next = new Set(prev);

            if (next.has(labelId)) next.delete(labelId);
            else next.add(labelId);

            return next;
        });

    return { activeLabels, toggleLabel };
};
