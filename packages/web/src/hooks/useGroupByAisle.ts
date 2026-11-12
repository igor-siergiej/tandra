import { useCallback, useState } from 'react';

const STORAGE_KEY = 'tandra.groupByAisle';

const read = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

/** Whether the items page groups by aisle; remembered across visits on this device. */
export const useGroupByAisle = (): [boolean, () => void] => {
    const [grouped, setGrouped] = useState(read);

    const toggle = useCallback(() => {
        setGrouped((current) => {
            const next = !current;

            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch {
                // Storage unavailable (private mode): the choice just lasts for this visit.
            }

            return next;
        });
    }, []);

    return [grouped, toggle];
};
