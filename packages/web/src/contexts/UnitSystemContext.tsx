import type React from 'react';
import { createContext, useContext, useState } from 'react';

import type { UnitSystem } from '../utils/convertUnits';

interface UnitSystemContextType {
    unitSystem: UnitSystem;
    setUnitSystem: (system: UnitSystem) => void;
}

const UnitSystemContext = createContext<UnitSystemContextType | undefined>(undefined);

export const useUnitSystem = () => {
    const context = useContext(UnitSystemContext);

    if (context === undefined) {
        throw new Error('useUnitSystem must be used within a UnitSystemProvider');
    }

    return context;
};

const STORAGE_KEY = 'unitSystem';

const isUnitSystem = (value: unknown): value is UnitSystem =>
    value === 'original' || value === 'metric' || value === 'imperial';

const getInitialUnitSystem = (): UnitSystem => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (isUnitSystem(stored)) return stored;
    } catch {
        // localStorage unavailable (private mode, disabled) — fall back to default.
    }

    return 'original';
};

export const UnitSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [unitSystem, setUnitSystemState] = useState<UnitSystem>(getInitialUnitSystem);

    const setUnitSystem = (system: UnitSystem) => {
        setUnitSystemState(system);

        try {
            localStorage.setItem(STORAGE_KEY, system);
        } catch (error) {
            console.warn('Failed to save unit system preference:', error);
        }
    };

    return <UnitSystemContext.Provider value={{ unitSystem, setUnitSystem }}>{children}</UnitSystemContext.Provider>;
};
