import { useCallback, useState } from 'react';

const STORAGE_KEY = 'tandra.voiceKeepListening';

const read = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

/** Whether voice dictation keeps going through pauses until stopped; remembered on this device. */
export const useKeepListening = (): [boolean, (value: boolean) => void] => {
    const [keepListening, setKeepListening] = useState(read);

    const set = useCallback((value: boolean) => {
        setKeepListening(value);

        try {
            localStorage.setItem(STORAGE_KEY, String(value));
        } catch {
            // Storage unavailable (private mode): the choice just lasts for this visit.
        }
    }, []);

    return [keepListening, set];
};
