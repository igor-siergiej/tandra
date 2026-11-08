const STORAGE_KEY = 'theme';

type Theme = 'light' | 'dark';

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

const getSystemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const readStoredTheme = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
};

const resolveTheme = (): Theme => {
    const stored = readStoredTheme();

    return isTheme(stored) ? stored : getSystemTheme();
};

// Points the manifest link at the theme-appropriate variant so future
// installs and browser manifest re-validations pick up matching native
// splash-screen colors. Cannot repaint an already-cached splash for an
// already-installed PWA instantly — browsers only revalidate periodically.
export const applyManifestForTheme = (doc: Document = document): void => {
    const link = doc.querySelector<HTMLLinkElement>('link[rel="manifest"]');

    if (!link) {
        return;
    }

    const theme = resolveTheme();
    link.setAttribute('href', theme === 'dark' ? '/manifest-dark.webmanifest' : '/manifest.webmanifest');
};
