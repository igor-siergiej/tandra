import { useCallback, useState } from 'react';

const STORAGE_KEY = 'tandra.voiceAck';

const read = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

/** Whether the user has seen where voice input goes; until then the mic stays closed. Remembered on this device. */
export const useVoiceAck = (): [boolean, () => void] => {
    const [acknowledged, setAcknowledged] = useState(read);

    const acknowledge = useCallback(() => {
        setAcknowledged(true);
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch {
            // Storage unavailable (private mode): the notice shows again next visit.
        }
    }, []);

    return [acknowledged, acknowledge];
};
