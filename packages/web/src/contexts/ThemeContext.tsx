import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { applyManifestForTheme } from '../utils/applyManifestForTheme';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
};

const STORAGE_KEY = 'theme';

const getSystemTheme = (): Theme => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialTheme = (): Theme => {
    // SAFETY: the value is narrowed to 'light' | 'dark' by the check on the next line before it is used.
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;

    if (stored && (stored === 'light' || stored === 'dark')) {
        return stored;
    }

    return getSystemTheme();
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    // Apply theme class to <html> element
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        // Update meta theme-color for PWA
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');

        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#2e7d32');
        }
    }, [theme]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);

        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch (error) {
            console.warn('Failed to save theme preference:', error);
        }

        applyManifestForTheme();
    };

    return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
